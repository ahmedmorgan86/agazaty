package com.ahmedmorgan.agazaty;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final String HOME = "https://agazaty-am.vercel.app/";
    private static final int FILE_PICKER = 701;
    private WebView webView;
    private LinearLayout errorView;
    private ValueCallback<Uri[]> fileCallback;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(13, 23, 33));
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

        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
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

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == FILE_PICKER && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
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
