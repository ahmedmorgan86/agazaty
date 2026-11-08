using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Agazaty.Windows;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new MainWindow());
    }
}

internal sealed class MainWindow : Form
{
    private static readonly Uri AppUrl = new("https://agazaty-am.vercel.app/");
    private readonly WebView2 browser = new() { Dock = DockStyle.Fill };

    public MainWindow()
    {
        Text = "أجازاتي | الحضور والورديات";
        Width = 1280;
        Height = 800;
        MinimumSize = new Size(760, 540);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(12, 23, 30);
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Controls.Add(browser);
    }

    protected override async void OnShown(EventArgs e)
    {
        base.OnShown(e);
        try
        {
            var dataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Agazaty", "WebView2");
            Directory.CreateDirectory(dataFolder);
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: dataFolder);
            await browser.EnsureCoreWebView2Async(environment);
            browser.CoreWebView2.NavigationStarting += (_, args) =>
            {
                if (IsDownloadUrl(args.Uri))
                {
                    args.Cancel = true;
                    OpenExternal(args.Uri);
                    return;
                }
                if (IsAppUrl(args.Uri)) return;
                args.Cancel = true;
                OpenExternal(args.Uri);
            };
            browser.CoreWebView2.NewWindowRequested += (_, args) =>
            {
                args.Handled = true;
                OpenExternal(args.Uri);
            };
            browser.CoreWebView2.WebMessageReceived += async (_, args) =>
            {
                if (!IsAppUrl(args.Source)) return;
                try
                {
                    var message = args.WebMessageAsJson;
                    if (message.Length > 20 * 1024 * 1024) return;
                    using var json = JsonDocument.Parse(message);
                    var data = json.RootElement;
                    if (data.GetProperty("type").GetString() != "saveExcel") return;
                    var filename = data.GetProperty("filename").GetString();
                    var base64 = data.GetProperty("data").GetString();
                    if (filename is null || !Regex.IsMatch(filename, @"^attendance_sheet_\d{4}-\d{2}\.xlsx$") || base64 is null) return;
                    using var dialog = new SaveFileDialog
                    {
                        FileName = filename,
                        Filter = "Excel workbook (*.xlsx)|*.xlsx",
                        DefaultExt = "xlsx",
                        AddExtension = true
                    };
                    if (dialog.ShowDialog(this) != DialogResult.OK) return;
                    File.WriteAllBytes(dialog.FileName, Convert.FromBase64String(base64));
                    await browser.ExecuteScriptAsync("showNotice('تم حفظ ملف Excel.', 'success')");
                }
                catch
                {
                    await browser.ExecuteScriptAsync("showNotice('تعذر حفظ ملف Excel.', 'error')");
                }
            };
            browser.Source = AppUrl;
        }
        catch (Exception ex)
        {
            MessageBox.Show(this,
                "تعذر فتح أجازاتي. تأكد من اتصال الإنترنت وتثبيت Microsoft Edge WebView2 Runtime.\n\n" + ex.Message,
                "أجازاتي", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static bool IsAppUrl(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        uri.Scheme == Uri.UriSchemeHttps &&
        uri.Host.Equals(AppUrl.Host, StringComparison.OrdinalIgnoreCase);

    private static bool IsDownloadUrl(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        uri.Host.Equals(AppUrl.Host, StringComparison.OrdinalIgnoreCase) &&
        (uri.AbsolutePath is "/apk" or "/windows" or "/agazaty-android.apk");

    private static void OpenExternal(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("https" or "mailto" or "tel")) return;
        try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); }
        catch { /* The site remains available in the app if Windows has no handler. */ }
    }
}
