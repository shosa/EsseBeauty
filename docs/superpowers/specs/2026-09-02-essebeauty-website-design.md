# EsseBeauty Website — Design Specification

## Objective

Create a standalone promotional application at `apps/website` that explains and sells EsseBeauty to Italian beauty salons and wellness businesses. The site must turn an unfamiliar visitor into a qualified lead while giving existing subscribers a direct, unmistakable path to the operational product.

The site is a narrative marketing surface, not part of the authenticated management interface. It presents only capabilities that already exist in the EsseBeauty suite and avoids invented customer counts, testimonials, prices, or performance claims.

## Audience and primary outcomes

The primary audience is an owner or manager of a beauty salon who currently coordinates appointments, clients, staff, stock, sales, and communications across paper, spreadsheets, messaging apps, or disconnected software.

The site has two primary outcomes:

1. A prospective customer understands the product and selects the primary conversion action, “Richiedi una demo”.
2. An existing subscriber selects “Accedi” and reaches the existing EsseBeauty login application.

The demo action is a contact conversion rather than an account-creation or payment flow. Every “Richiedi una demo” action opens the same accessible contact modal. Until a delivery service is configured, submitting the validated form opens a composed email in the visitor’s mail application. The interface must state this behavior instead of displaying a false sent/saved confirmation. The contact destination remains centralized so the bridge can later be replaced by an API, CRM, or email provider without redesigning the form.

## Product positioning

Core promise: **“Il tuo centro estetico, finalmente tutto sotto controllo.”**

EsseBeauty is positioned as the connected operating system for a beauty business: one calm workspace that joins daily scheduling, customer care, team coordination, commerce, inventory, communications, and business visibility.

The copy will emphasize concrete outcomes:

- less time spent switching between tools;
- a clearer day for reception and collaborators;
- complete and useful client histories;
- more consistent follow-up, loyalty, and review collection;
- tighter control over sales, expenses, products, and stock;
- faster decisions based on current operational data.

Claims will remain qualitative unless the repository supplies verifiable evidence for a numerical claim.

## Information architecture

The website uses a focused sales homepage plus a dedicated module-catalog route. The homepage preserves its anchored narrative, while `/moduli` gives interested prospects enough detail to evaluate the complete suite without overloading the primary sales story.

### Header

- EsseBeauty brand mark and wordmark.
- Navigation: “Funzionalità”, “Tutti i moduli”, “Come funziona”, “Perché EsseBeauty”.
- Secondary action: “Accedi”.
- Primary action: “Richiedi una demo”.
- Responsive mobile menu with semantic controls and full keyboard support.

“Accedi” must remain visually distinct from the demo action and link to the existing web application login route. Both destinations will be centralized as constants or environment-backed public configuration.

### Hero

- Eyebrow identifying the product as software for beauty salons.
- Main promise: “Il tuo centro estetico, finalmente tutto sotto controllo.”
- Short explanation connecting appointments, clients, team, sales, and growth.
- Primary and secondary calls to action.
- A polished product composition based on representative EsseBeauty interface panels, built as interface-native markup rather than a fabricated photographic scene.
- A compact trust strip focused on product qualities such as “Pensato per il beauty”, “Tutto in un unico spazio”, and “Accessibile ovunque”, avoiding unverifiable social proof.

### Problem-to-outcome section

A short transition shows the difference between fragmented management and a connected working day. It will use three outcome statements rather than generic feature-card repetition.

### Feature narrative

Capabilities are grouped into four commercial pillars:

1. **Ogni giornata scorre meglio** — calendar, appointments, waitlist, cabins/resources, and staff coordination.
2. **Ogni cliente è davvero conosciuto** — customer profiles, history, consents/documents, loyalty, vouchers/packages, and reviews.
3. **Ogni vendita resta sotto controllo** — checkout, services/products, expenses, inventory, suppliers, and warehouse documents.
4. **Ogni decisione parte dai dati giusti** — dashboard, reports, operational indicators, targeted marketing, and WhatsApp communication flows.

Each pillar combines concise outcome-led copy, a short capability list, and a representative interface preview. The composition alternates rhythm without changing the core component language.

### Complete modules page

`/moduli` is the evaluation page for prospects who need more depth before contacting EsseBeauty. It shares the website header, contact modal, final conversion section, and footer, but uses a denser catalog layout rather than repeating the homepage narrative.

The page opens with a compact editorial hero and a clear explanation that modules work as one connected suite. An in-page category navigator links to eight groups:

1. **Agenda e operatività** — calendar, appointments, waitlist, salon closures, cabins, and scheduling resources.
2. **Clienti e fidelizzazione** — customer records, history, segmentation, loyalty, packages, and vouchers.
3. **Team e risorse** — collaborators, permissions, availability, requests, working rules, and staff workspace.
4. **Cassa e vendite** — checkout, services, products, payment records, packages, vouchers, and daily commercial operations.
5. **Magazzino e acquisti** — inventory, stock movements, suppliers, purchase documents, expenses, counts, and analytics.
6. **Marketing e WhatsApp** — audiences, campaigns, templates, consent-aware WhatsApp communication, and conversation workspace.
7. **Recensioni e documenti** — review invitations, delivery status, consent templates, signing flows, and evidence records.
8. **Report e amministrazione** — dashboard indicators, reports, accounting views, settings, locations, modules, and operational controls.

Each group contains a benefit-led heading, a concise explanation, and focused module cards. Every card names a real capability, explains what it enables, and lists representative functions. The page does not imply that every feature is included in every commercial plan because plans are not yet defined.

### Demo-contact modal

The modal is available through a shared `DemoContactProvider` and `DemoContactButton`, so all existing and future demo CTAs open the same flow without duplicating state or markup. It contains:

- name (required);
- salon/business name (required);
- email (required, browser-valid email format);
- phone (optional);
- team-size choice (required: “Solo io”, “2–5 persone”, “6–10 persone”, “Più di 10”);
- free-text message (optional);
- a short disclosure that continuing opens the visitor’s email application and does not yet submit data directly to EsseBeauty.

The modal uses a native `<dialog>` or an equivalently accessible dialog primitive with an accessible title and description, focus containment, Escape dismissal, close control, and focus restoration. Background scrolling is disabled while it is open. Submission uses browser validation, composes the entered data into the centralized mailto destination, and navigates to that mailto URL. It never shows “sent”, “saved”, or a success confirmation because no server has accepted the data.

The existing-subscriber “Accedi” action remains a normal link and never opens the contact modal.

### “How it works” section

Three steps describe adoption without promising an unsupported onboarding service:

1. Configure the salon, services, team, and working rules.
2. Bring daily operations into one connected workspace.
3. Use customer, commercial, and operational information to improve continuously.

### Reasons to choose EsseBeauty

A focused proof section explains the product’s distinguishing qualities:

- designed around real beauty-salon workflows;
- one suite shared by reception, staff, and clients;
- clear interfaces that remain usable during busy working hours;
- connected records instead of duplicated information;
- modular capabilities that support the business as it evolves.

No testimonials, partner logos, customer counts, star ratings, or invented guarantees will be included.

### Final conversion section and footer

The closing section repeats the primary promise and demo CTA, with “Sei già cliente? Accedi a EsseBeauty” as the subscriber path. The footer includes product navigation, a contact link, and placeholders only for legal destinations that already exist; nonexistent policy pages will not be linked.

## Visual direction

The experience should feel premium, editorial, calm, and operationally credible rather than cosmetic or overly decorative.

### Palette

- Deep plum/burgundy as the principal brand and interaction color.
- Warm ivory and off-white backgrounds instead of stark white.
- Dusty rose and muted blush for soft supporting surfaces.
- Dark espresso text for strong readability.
- Restrained green or amber only for meaningful interface statuses.

Semantic design tokens will define backgrounds, foregrounds, borders, muted text, brand actions, focus rings, and status colors. Body text and controls must meet WCAG AA contrast; interaction and status cannot rely on color alone.

### Typography

A high-character editorial display face will be paired with a legible contemporary sans-serif for product copy and interface labels. Fonts must load without exposing content to layout breakage, and robust fallbacks will be supplied. The type scale will use fluid sizing with controlled line lengths.

### Layout and surfaces

- Generous but purposeful negative space.
- A responsive content width around 1200–1280px.
- Rounded surfaces used selectively, with a consistent radius scale.
- Fine borders and soft shadows rather than heavy glass effects.
- Interface previews with realistic Italian labels and data.
- Asymmetrical editorial compositions on wide screens, collapsing into a clear single-column reading order on mobile.

### Motion

Motion is limited to subtle entrance, hover, and interface emphasis. All animation respects `prefers-reduced-motion`; no auto-playing carousels, parallax, or time-dependent content is required.

## Accessibility and interaction requirements

- Semantic landmarks and a logical heading hierarchy.
- Skip link to main content.
- Full keyboard navigation and visible focus indicators.
- Mobile touch targets of at least 44px where practical.
- Accessible labels for icon-only controls and menu state announcement.
- Text remains usable at 200% zoom and through responsive reflow.
- Decorative visuals are hidden from assistive technology; meaningful previews have concise descriptions.
- No information is conveyed only through color or animation.
- Navigation remains functional with JavaScript unavailable where normal links suffice.

These requirements apply the repository’s design guidance for accessibility, color, typography, layout, branding, and restrained motion.

## Technical architecture

`apps/website` will be a distinct workspace package so it can run, build, and deploy independently of `apps/web`, `apps/platform`, and the PWAs. It will follow the monorepo’s package-manager and TypeScript conventions.

The preferred implementation is a lightweight Next.js application matching the existing workspace, using the App Router and server-rendered marketing content. Client-side JavaScript is limited to the responsive menu or genuinely interactive presentation details. No database, authentication state, API route, or shared runtime dependency is required for the first version.

Primary files are expected to include:

- app layout and metadata;
- a homepage composing the marketing sections and a `/moduli` catalog page;
- a small set of focused presentational components;
- a shared client-side contact-dialog provider and trigger component;
- global styles and semantic design tokens;
- public brand and social-preview assets;
- package and framework configuration aligned with the workspace.

Existing EsseBeauty brand assets may be reused where appropriate. Product preview markup will be isolated into reusable components so it can later be replaced by real screenshots without restructuring the page.

## Configuration and external destinations

The login URL and demo-contact address are external configuration. Safe defaults may point to the current local/product login path and an explicit placeholder contact address only if a real destination cannot be discovered in repository configuration. A placeholder must be clearly centralized and documented rather than scattered through components.

No analytics, cookie banner, CRM, scheduling provider, or newsletter subscription will be added without an actual destination and consent requirements.

## Metadata and sharing

The application will define an Italian title, description, canonical-ready metadata, Open Graph fields, and social-card metadata. The social preview will visually match the site and use exact, legible EsseBeauty copy. Icons and brand imagery must be stored locally and optimized for delivery.

## Responsive behavior

- Desktop: full navigation, asymmetric hero, and alternating feature compositions.
- Tablet: simplified columns while retaining previews and conversion visibility.
- Mobile: single-column story, compact sticky or always-reachable header actions without covering content, no horizontal overflow, and previews simplified rather than illegibly scaled down.

CTA ordering remains consistent: demo first for prospects, access second for subscribers.

## Error and fallback behavior

Because the page is primarily server-rendered and static, failure modes are deliberately small:

- web fonts fall back to system fonts without hiding content;
- images reserve dimensions and provide appropriate alternatives;
- a missing optional visual does not remove the relevant product explanation;
- external links use normal navigation and remain understandable when the destination is unavailable;
- the mobile menu defaults to a usable closed state and exposes navigation through progressive enhancement.

## Verification strategy

Verification will cover:

- workspace package configuration and production build;
- static checks for required commercial sections and both primary CTAs;
- login and demo links using their centralized destinations;
- accessible landmarks, heading order, labels, focus treatment, and reduced-motion rules;
- responsive CSS behavior and horizontal overflow prevention;
- absence of unsupported numerical claims or fabricated social proof;
- metadata, icon, and social-preview configuration;
- regression safety for the other workspace packages through targeted workspace checks.

Browser visual QA is outside the initial requirement unless explicitly requested; the first meaningful local preview will still be opened once the representative hero, theme, and primary conversion path compile successfully.

## Out of scope for the first release

- Pricing and online purchase, because commercial plans are not specified.
- Account registration or subscriber authentication inside the website.
- A custom lead database, direct email delivery, or CRM integration.
- Live chat, chatbot, newsletter, or marketing automation.
- Blog, customer case studies, testimonials, or partner logos.
- Internationalization beyond Italian.
- Product-tour video or autoplaying media.
- Separate pricing or legal routes without real content requirements.

## Completion criteria

The website is complete when it runs as an independent workspace application, accurately presents the existing suite on both the homepage and the complete `/moduli` catalog, creates a polished and responsive sales narrative, offers a reusable and truthful demo-contact modal, provides a prominent existing-subscriber login path, meets the stated accessibility requirements, defines complete metadata for both routes, and passes its production build and focused verification checks.
