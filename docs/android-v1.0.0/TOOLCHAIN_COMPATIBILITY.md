# Toolchain compatibility note — Android 1.0.0

**قرار CI بعد أول AAR metadata check (23 نوفمبر 2026):**

- Compose BOM 2026.09.00 يجلب Compose 1.12.1، وهذه المكتبات تتطلب compileSdk 37.
- إصدار Compose 1.12 وما بعده يرفع compileSdk إلى API 37 بحسب Android Developers. في بيئة GitHub Actions الحالية، API 37 ما زال يطلب ترخيص Android SDK Preview؛ لذلك لن نربط إصدار الإنتاج بمنصة Preview.
- نثبت مؤقتاً Compose BOM 2026.07.00 (Compose 1.11.4) وNavigation 3.1.6، مع compileSdk/targetSdk 36 المستقرين.
- لا نخفض targetSdk إلى 35؛ targetSdk يبقى 36.
- عند صدور Android API 37 كمنصة stable، نرفع compileSdk وCompose BOM وNavigation3 معاً بعد CI وdevice tests.

هذا القرار لا يعني أن Compose 1.12/1.13 غير مستقرة؛ بل إن متطلبات compileSdk الخاصة بها تسبق توفر منصة Android 37 المستقرة في بيئة البناء الحالية. المصدر الرسمي: https://developer.android.com/blog/posts/what-s-new-in-the-jetpack-compose-august-26-release
