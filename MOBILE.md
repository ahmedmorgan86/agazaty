# تطبيق أجازاتي للموبايل

## Android

المشروع داخل `android/` تطبيق Android يعرض الموقع المنشور في WebView عبر HTTPS. يدعم تسجيل الدخول ورفع الملفات من منتقي النظام. يحتاج إلى الإنترنت؛ لا تحفظ النسخة المحلية سجلات الموظفين.

يبني GitHub Actions ملف `agazaty-android.apk` عند الدمج في `main` ويضعه في إصدار `android-v1.0.0`. زر التنزيل ورمز QR يستخدمان الرابط القصير `https://agazaty-am.vercel.app/apk` الذي يعيد التوجيه إلى ملف الإصدار على GitHub. يوجد رابط بديل لصفحة الإصدار عند تعذر التنزيل المباشر. هذا الإصدار موقّع بتوقيع تصحيح Android تلقائي، وهو مناسب للتثبيت المباشر للتجربة، وليس مفتاح نشر دائمًا للتحديثات أو متجر Play. للإصدارات التالية يلزم إعداد مفتاح توقيع إصدار ثابت وآمن وزيادة `versionCode`.

للبناء محليًا مع Android SDK وGradle 8.13 وJDK 17:

```bash
mkdir -p android/app/src/main/res/drawable
cp assets/icon-192.png android/app/src/main/res/drawable/app_icon.png
gradle -p android :app:assembleDebug
```

## iPhone

افتح `https://agazaty-am.vercel.app/` في Safari ثم اضغط «مشاركة» ← «إضافة إلى الشاشة الرئيسية» ← «إضافة». في بعض إصدارات iOS يمكن اختيار «فتح كتطبيق ويب». ملف APK لا يعمل على iPhone؛ الموقع يستخدم أيقونة Apple ومظهر الشاشة المستقلة.

لا تغيّر رابط إصدار APK في واجهة الدخول قبل اكتمال بناء GitHub Actions ونشر الإصدار.
