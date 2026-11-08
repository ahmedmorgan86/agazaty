package com.ahmedmorgan.agazaty;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsetsController;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.OutputStream;

public final class MainActivity extends Activity {
    private static final String HOME = "https://agazaty-am.vercel.app/";
    private static final int FILE_PICKER = 701;
    private static final int EXPORT_PICKER = 702;
    private WebView webView;
    private LinearLayout errorView;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingExportBytes;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(243, 247, 247));
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().getInsetsController().setSystemBarsAppearance(
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
        } else if (Build.VERSION.SDK_INT >= 23) {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
        getWindow().setNavigationBarColor(Color.rgb(13, 23, 33));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setFitsSystemWindows(true);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(13, 23, 33));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setUserAgentString(settings.getUserAgentString() + " AgazatyAndroid/1.3.5");
        webView.addJavascriptInterface(new AndroidExport(), "AgazatyAndroidExport");

        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return request.isForMainFrame() && handleNavigation(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                errorView.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    webView.setVisibility(View.GONE);
                    errorView.setVisibility(View.VISIBLE);
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent picker = new Intent(Intent.ACTION_GET_CONTENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType("*/*");
                try { startActivityForResult(Intent.createChooser(picker, "اختر ملف السجلات"), FILE_PICKER); }
                catch (ActivityNotFoundException e) { fileCallback = null; callback.onReceiveValue(null); }
                return true;
            }
        });

        errorView = new LinearLayout(this);
        errorView.setOrientation(LinearLayout.VERTICAL);
        errorView.setGravity(Gravity.CENTER);
        errorView.setBackgroundColor(Color.rgb(13, 23, 33));
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.app_icon);
        float density = getResources().getDisplayMetrics().density;
        LinearLayout.LayoutParams logoLayout = new LinearLayout.LayoutParams((int)(96 * density), (int)(96 * density));
        logoLayout.bottomMargin = (int)(24 * density);
        errorView.addView(logo, logoLayout);
        TextView message = new TextView(this);
        message.setText("تعذر الاتصال بأجازاتي. تحقق من الإنترنت ثم حاول مرة أخرى.");
        message.setTextColor(Color.WHITE);
        message.setTextSize(17);
        message.setGravity(Gravity.CENTER);
        message.setPadding(30, 0, 30, 24);
        Button retry = new Button(this);
        retry.setText("إعادة المحاولة");
        retry.setOnClickListener(v -> webView.loadUrl(HOME));
        errorView.addView(message);
        errorView.addView(retry);
        errorView.setVisibility(View.GONE);
        root.addView(webView, new LinearLayout.LayoutParams(-1, 0, 1));
        root.addView(errorView, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        if (state == null) webView.loadUrl(HOME);
        else webView.restoreState(state);
    }

    private boolean handleNavigation(Uri url) {
        if ("agazaty".equals(url.getScheme()) && "print-report".equals(url.getHost())) {
            Uri current = Uri.parse(webView.getUrl() == null ? "" : webView.getUrl());
            if ("agazaty-am.vercel.app".equals(current.getHost())) {
                PrintManager manager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                if (manager != null) manager.print("تقرير أجازاتي", webView.createPrintDocumentAdapter("تقرير الموظف"),
                    new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            }
            return true;
        }
        if ("agazaty-am.vercel.app".equals(url.getHost()) &&
            ("/apk".equals(url.getPath()) || "/windows".equals(url.getPath()) ||
             "/agazaty-android.apk".equals(url.getPath()))) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, url)); } catch (ActivityNotFoundException ignored) { }
            return true;
        }
        if ("https".equals(url.getScheme()) && "agazaty-am.vercel.app".equals(url.getHost())) return false;
        if ("https".equals(url.getScheme()) || "mailto".equals(url.getScheme()) || "tel".equals(url.getScheme())) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, url)); } catch (ActivityNotFoundException ignored) { }
        }
        return true;
    }

    private final class AndroidExport {
        @JavascriptInterface public void saveExcel(String base64, String filename) {
            runOnUiThread(() -> {
                Uri current = Uri.parse(webView.getUrl() == null ? "" : webView.getUrl());
                if (!"https".equals(current.getScheme()) ||
                    !"agazaty-am.vercel.app".equals(current.getHost()) ||
                    filename == null || !filename.matches("attendance_sheet_\\d{4}-\\d{2}\\.xlsx") ||
                    base64 == null || base64.length() > 20 * 1024 * 1024) return;
                try {
                    pendingExportBytes = Base64.decode(base64, Base64.DEFAULT);
                    Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    save.addCategory(Intent.CATEGORY_OPENABLE);
                    save.setType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                    save.putExtra(Intent.EXTRA_TITLE, filename);
                    startActivityForResult(save, EXPORT_PICKER);
                } catch (Exception error) {
                    pendingExportBytes = null;
                    Toast.makeText(MainActivity.this, "تعذر تجهيز ملف Excel.", Toast.LENGTH_LONG).show();
                }
            });
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == FILE_PICKER && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        }
        if (request == EXPORT_PICKER && pendingExportBytes != null) {
            try {
                if (result == RESULT_OK && data != null && data.getData() != null) {
                    try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                        if (output == null) throw new IllegalStateException("No output stream");
                        output.write(pendingExportBytes);
                    }
                    Toast.makeText(this, "تم حفظ ملف Excel.", Toast.LENGTH_LONG).show();
                }
            } catch (Exception error) {
                Toast.makeText(this, "تعذر حفظ ملف Excel.", Toast.LENGTH_LONG).show();
            } finally {
                pendingExportBytes = null;
            }
        }
    }
    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        webView.saveState(state);
        super.onSaveInstanceState(state);
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        webView.destroy();
        super.onDestroy();
    }
}
