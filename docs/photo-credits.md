# Photo credits

Editorial photography on the public site (`public/photos/`). Every image is from
Unsplash under the free [Unsplash License](https://unsplash.com/license):
commercial use allowed, no attribution required (credited here anyway). None is
an Unsplash+ (premium) image — all were downloaded from `images.unsplash.com`,
never `plus.unsplash.com`.

The people shown are illustrative of the service context only. They are not
DEAL clients, staff or testimonials, and must never be captioned as such.

Each file is generated as AVIF + WebP at two widths (`<name>-<w>.avif|webp`),
cropped with `sharp`; the registry is `src/lib/photos.ts`.

| File | Unsplash photo page | Photographer | Used for |
| --- | --- | --- | --- |
| `hero-man` | https://unsplash.com/photos/man-in-white-thobe-standing-I4B-IZ7cd-g | Abdulrhman Alkhnaifer | Home hero, main photo |
| `hero-woman` | https://unsplash.com/photos/a-person-holding-a-laptop-7mBictB_urk | Not recorded (photo page behind a bot check) | Home hero; service photo for «استخدام الذكاء الاصطناعي» (/start, /start/ai) |
| `ops-desk` | https://unsplash.com/photos/a-person-sitting-at-a-desk-with-a-laptop-and-a-clipboard-yfzRnYRHYLw | Not recorded (photo page behind a bot check) | Home hero, small photo |
| `team-talk` | https://unsplash.com/photos/a-couple-of-women-sitting-on-a-couch-FHhbHW4vFxc | Microsoft 365 | Home «من نحن»; /login brand panel |
| `portrait` | https://unsplash.com/photos/man-in-white-dress-shirt-wearing-red-and-white-hijab-ruWf1KGPPsY | Not recorded (photo page behind a bot check) | Home «ذكاء سعودي» inset; /start hero |
| `shopkeeper` | https://unsplash.com/photos/a-man-in-traditional-omani-attire-stands-before-a-shop-ewOcj59oySY | Not recorded (photo page behind a bot check) | Home «الحل اللحظي» inset; service photo for «الحل اللحظي» (crm) |
| `handshake` | https://unsplash.com/photos/a-couple-of-men-shaking-hands-over-a-desk-MA4aW8ZOzLM | Not recorded (photo page behind a bot check) | Home «مكتب المحامي» inset; service photo for «مكتب المحامي» (law) |
| `pay-qr` | https://unsplash.com/photos/two-persons-hands-holding-turned-on-phones-QiPe0UpC0_U | Not recorded (photo page behind a bot check) | Home «الدفع المبسط» inset; service photo for «الدفع المبسط» (pay) |
| `brand-abaya` | https://unsplash.com/photos/two-women-in-elegant-abayas-standing-indoors-adOqgac8v6U | Not recorded (photo page behind a bot check) | Service photo for «بناء العلامة التجارية» (brand) |
| `audience-phone` | https://unsplash.com/photos/a-couple-of-women-sitting-on-top-of-a-boat-zuVpCReVe80 | Not recorded (photo page behind a bot check) | Service photo for «التسويق عبر المؤثرين» (influencers) |
| `studio` | https://unsplash.com/photos/a-group-of-people-standing-around-a-camera-set-up-xKfS7Hll0Ck | Not recorded (photo page behind a bot check) | Service photo for «التصوير والإنتاج المرئي» (production) |
| `conference` | https://unsplash.com/photos/speaker-on-stage-addressing-large-audience-6vAjp0pscX0 | Not recorded (photo page behind a bot check) | Service photo for «تنظيم الفعاليات» (events) |
| `microphone` | https://unsplash.com/photos/silver-corded-microphone-in-shallow-focus-photography-LETdkk7wHQk | Not recorded (photo page behind a bot check) | Service photo for «إدارة المراكز الإعلامية» (media) |
| `najd` | https://unsplash.com/photos/mud-brick-architecture-with-tower-reflection-kUANvJwGN4M | Abdulrhman Alkhnaifer | Home «من نحن» (Najdi mud-brick architecture) |
| `riyadh-road` | https://unsplash.com/photos/a-view-of-a-highway-with-cars-and-buildings-in-the-background-LaTkDwOBDZ4 | ANAS MAQSOOD | 404 page |
| `analyst` | https://unsplash.com/photos/a-man-sitting-at-a-table-looking-at-a-tablet-oJ4E_Vm5HaI | Amina Atar | /developers header |

Notes

- Photographer names marked "Not recorded" could not be read because
  unsplash.com served a bot check during the download session. The image IDs
  and photo pages above are exact; open a page to see the photographer.

- `hero-woman` and `team-talk` come from the same shoot; the laptop in
  `hero-woman` shows a small Windows logo.
- `shopkeeper` is described on Unsplash as Omani attire; it illustrates a Gulf
  shop owner generically.
- The product screenshots (`public/images/ops-*`, `desk-home`, `pay-home`), the
  chairman portrait and the portfolio stills (`public/images/work-*`) are the
  site's own assets and are not covered by this file.
