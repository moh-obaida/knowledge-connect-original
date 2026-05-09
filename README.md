# وصلة المعرفة — Knowledge Connect

**تحدي الفرق التفاعلي للفصل الدراسي**

لعبة مسابقة تفاعلية مستوحاة من Kahoot وQuizizz، مع لوحة حروف حيث لكل حرف سؤاله الخاص.

---

## المميزات

- 🎮 **لوحة حروف تفاعلية** — كل حرف/خلية لها سؤالها الخاص
- 🔥 **Firebase Realtime Database** — مزامنة فورية بين المضيف والمشاركين
- 📱 **رمز غرفة مكوّن من 6 أرقام** — مثل Kahoot
- 👨‍🏫 **لوحة تحكم للمضيف** — إنشاء أسئلة، التحكم باللعبة، كشف الإجابات
- 👥 **شاشة المشاركين** — مناسبة للعرض على البروجكتور
- 🌙 **واجهة عربية كاملة** — RTL، خط Cairo
- 🆓 **مجاني بالكامل** — لا اشتراكات، لا ميزات مدفوعة

---

## الصفحات

| الصفحة | الرابط | الوصف |
|--------|--------|-------|
| لوحة التحكم للمضيف | `/` | إنشاء الغرفة، إضافة الأسئلة، التحكم باللعبة |
| صفحة الانضمام | `/join` | المشاركون يدخلون رمز الغرفة واسمهم |
| شاشة المشاركين | `/participant?room=XXXXXX` | الشاشة الحية للمشاركين |

---

## إعداد Firebase (مطلوب)

### الخطوة ١: إنشاء مشروع Firebase

1. افتح [Firebase Console](https://console.firebase.google.com)
2. انقر **Add project** (إضافة مشروع)
3. أدخل اسم المشروع (مثال: `wasla-almarifa`)
4. اتبع الخطوات وانقر **Create project**

### الخطوة ٢: تفعيل Realtime Database

1. في القائمة الجانبية، انقر **Build → Realtime Database**
2. انقر **Create Database**
3. اختر موقع قريب منك (مثال: `us-central1`)
4. اختر **Start in test mode** (للاختبار)
5. انقر **Enable**

### الخطوة ٣: قواعد Realtime Database (للاختبار)

في **Realtime Database → Rules**، ضع هذه القواعد للاختبار:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> ⚠️ **تحذير:** هذه القواعد مفتوحة للاختبار فقط. للإنتاج، استخدم قواعد أكثر أماناً.

**قواعد الإنتاج المقترحة:**
```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

### الخطوة ٤: إضافة تطبيق ويب

1. في **Project Settings** (⚙️ بجانب اسم المشروع)
2. انقر **Add app → Web** (</> )
3. أدخل اسم التطبيق
4. انقر **Register app**
5. **انسخ** قيم `firebaseConfig`

### الخطوة ٥: إضافة متغيرات البيئة

#### للتطوير المحلي

1. في **جذر المستودع** (حيث يوجد `package.json` و`vite.config.ts`)، انسخ القالب ثم عدّل القيم:
   ```bash
   cp .env.example .env
   ```
2. افتح `.env` واستبدل كل قيمة `replace-with-...` / `your-project-id` بقيم `firebaseConfig` من Firebase Console.

**المتغيرات السبعة المطلوبة** (كلها بادئة `VITE_FIREBASE_` وتُمرَّر إلى عميل Vite):

| المتغير | ملاحظة |
|---------|--------|
| `VITE_FIREBASE_API_KEY` | مطلوب؛ مع `DATABASE_URL` يحددان اعتبار Firebase «مُعدّاً» في الواجهة |
| `VITE_FIREBASE_AUTH_DOMAIN` | مطلوب لتهيئة التطبيق |
| `VITE_FIREBASE_DATABASE_URL` | مطلوب لـ Realtime Database |
| `VITE_FIREBASE_PROJECT_ID` | مطلوب لتهيئة التطبيق |
| `VITE_FIREBASE_STORAGE_BUCKET` | مطلوب لتهيئة التطبيق |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | مطلوب لتهيئة التطبيق |
| `VITE_FIREBASE_APP_ID` | مطلوب لتهيئة التطبيق |

> لا ترفع ملف `.env` إلى Git — هو مستبعد في `.gitignore`. استخدم `.env.example` فقط كقالب بلا أسرار.

قالب بقيم وهمية (راجع أيضاً `.env.example` في الجذر):

```env
VITE_FIREBASE_API_KEY=replace-with-your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:0000000000000000000000
```

#### للنشر على Netlify

في **Netlify → Site Settings → Environment Variables**، أضف نفس المتغيرات أعلاه.

---

## النشر على Netlify

### الطريقة ١: عبر واجهة Netlify

1. افتح [netlify.com](https://netlify.com) وسجّل دخولك
2. انقر **Add new site → Import an existing project**
3. اربط مستودع GitHub الخاص بك
4. اضبط إعدادات البناء:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. أضف متغيرات البيئة (Firebase config) في **Site Settings → Environment Variables**
6. انقر **Deploy site**

### الطريقة ٢: سحب وإفلات

1. شغّل `npm run build` محلياً
2. افتح [netlify.com/drop](https://app.netlify.com/drop)
3. اسحب مجلد `dist` إلى الصفحة

### ملف _redirects

الملف `client/public/_redirects` موجود مسبقاً بالمحتوى:
```
/*    /index.html   200
```
هذا يضمن عمل التوجيه (routing) بشكل صحيح على Netlify.

---

## التشغيل المحلي

بعد إنشاء `.env` من `.env.example` وملء متغيرات Firebase:

```bash
# تثبيت الاعتماديات (إن لم يكن pnpm متاحاً كأمر مباشر، استخدم npx)
npx pnpm install

# تشغيل خادم التطوير (المنفذ الافتراضي 3000 حسب إعداد Vite)
npx pnpm dev

# بناء للإنتاج
npx pnpm build
```

افتح المتصفح على: `http://localhost:3000` (أو المنفذ الذي يطبعه Vite إذا كان 3000 مستخدماً).

---

## كيفية استخدام التطبيق

### المضيف

1. افتح `/` (لوحة التحكم)
2. انقر **إنشاء غرفة جديدة** — ستحصل على رمز مكوّن من 6 أرقام
3. في تبويب **إعداد أسئلة الحروف**:
   - انقر على كل حرف لإضافة سؤاله وإجابته
   - أضف التصنيف والصعوبة والنقاط والتلميح اختيارياً
4. شارك رمز الغرفة مع المشاركين (أو انسخ رابط الانضمام)
5. انقر **بدء اللعبة**
6. في تبويب **التحكم باللعبة**:
   - انقر على حرف في اللوحة لتحميل سؤاله
   - تحكم في المؤقت
   - اكشف الإجابة للمشاركين عند الحاجة
   - انقر **إجابة صحيحة** لمنح الحرف للفريق النشط
   - انقر **إجابة خاطئة** إذا أخطأ الفريق

### المشاركون

1. افتح `/join` من أي جهاز
2. أدخل رمز الغرفة المكوّن من 6 أرقام
3. أدخل اسمك
4. انقر **انضم الآن**
5. ستنتقل تلقائياً إلى شاشة اللعبة

---

## اختبار الروابط بعد النشر

| الرابط | الوصف |
|--------|-------|
| `https://your-site.netlify.app/` | لوحة التحكم للمضيف |
| `https://your-site.netlify.app/join` | صفحة انضمام المشاركين |
| `https://your-site.netlify.app/participant?room=123456` | شاشة المشاركين |

---

## بنية الملفات

```
client/
  src/
    pages/
      HostView.tsx       ← لوحة التحكم للمضيف
      JoinPage.tsx       ← صفحة الانضمام
      ParticipantView.tsx ← شاشة المشاركين
    lib/
      store.ts           ← نماذج البيانات وأنواع TypeScript
      firebase.ts        ← إعداد Firebase
      roomOps.ts         ← عمليات Firebase (إنشاء/قراءة/تحديث الغرف)
    components/
      KcToast.tsx        ← إشعارات التنبيه
    index.css            ← التصميم العام
    App.tsx              ← التوجيه (routing)
  public/
    _redirects           ← إعادة توجيه Netlify للـ SPA
```

---

## نموذج بيانات الغرفة (Firebase)

```
rooms/
  {roomCode}/
    roomCode: "123456"
    gameTitle: "تحدي وصلة المعرفة"
    gameStatus: "lobby" | "active" | "finished"
    team1: { name, color, initials }
    team2: { name, color, initials }
    team1Score: 0
    team2Score: 0
    board: [
      {
        id: "cell-0",
        label: "أ",
        question: "...",
        answer: "...",
        category: "...",
        difficulty: "easy",
        points: 1,
        hint: "...",
        explanation: "...",
        used: false,
        claimedBy: 0
      }
    ]
    activeQuestion: { ... } | null
    answerVisibleToHost: false
    answerVisibleToParticipants: false
    hintVisibleToParticipants: false
    timerValue: 30
    timerRunning: false
    winnerMessage: ""
    players: { playerId: { name, joinedAt } }
```

---

## تحديثات مستقبلية مقترحة

- 🔔 وضع البازر — المشاركون يضغطون للإجابة أولاً
- 👤 نقاط فردية لكل مشارك
- 🖼️ صور في الأسئلة
- 🔐 تسجيل دخول للمضيف
- ☁️ بنك أسئلة سحابي مشترك
- 🔊 مؤثرات صوتية

---

## ملاحظة مهمة

هذا التطبيق **مجاني بالكامل**. Firebase Realtime Database يوفر خطة مجانية (Spark) كافية للاستخدام في الفصل الدراسي.
