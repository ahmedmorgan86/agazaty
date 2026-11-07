# أجازاتي

تطبيق عربي لإدارة الحضور والورديات والإجازات. يحتوي المستودع على واجهة ويب، تطبيق Android، وقواعد Firebase Firestore.

## تشغيل محلي

```sh
npm ci
npm run check
python -m http.server 8080 -d public
```

المعاينة التجريبية للواجهة متاحة عبر `http://localhost:8080/?preview=1` وتستخدم بيانات توضيحية محلية.

## بنية المشروع

- `index.html` و`theme.css`: الواجهة.
- `firebase-cloud.js`: الاتصال بخدمات Firebase.
- `firestore.rules` و`firestore.indexes.json`: قواعد البيانات وفهارسها.
- `android/`: مشروع تطبيق Android.
- `public/`: ملفات النشر التي يولدها `python build_public.py`.

## التحقق

```sh
npm run check
npm test
```

يُشغّل `npm test` فحوص قواعد Firestore باستخدام المحاكي المحلي. اضبط إعدادات Firebase والاستضافة في حسابك قبل النشر، واحتفظ بأي قيم خاصة خارج المستودع.
