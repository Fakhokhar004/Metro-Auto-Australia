# Metro Auto website design: handoff for building the Shopify theme

This folder holds the approved design for metroautoonline.com.au. Every page and shared component is one `.dc.html` file. Use them as the **visual and behaviour reference** for building Shopify theme sections. They are not Liquid and should not be copied into the theme as they are.

Each file has three parts:
- the markup inside `<x-dc>`;
- the CSS inside `<helmet><style>`;
- the behaviour in the `<script type="text/x-dc">` block at the bottom (`class Component`, where `renderVals()` holds the logic).

`{{name}}` placeholders are values from `renderVals()`. `<sc-for>` is a loop, `<sc-if>` is a condition, and `<dc-import name="X">` inserts a shared component.

## Pages → Shopify templates

| Design file | Shopify template / section | Notes |
|---|---|---|
| pages/Main.dc.html | `templates/index.json` | Hero, trust cards, vehicle selector band, category bento, shipping cards, marquee, "Parts for your vehicle", Hot Deals, brand cards, METRO15 banner. The left sidebar is on Home only. |
| pages/Search.dc.html | `templates/search.json` | Search & Discovery filters on the left: Availability, Price, Brand, Product type, Category. Modes: text, tag, vehicle (fits plus "also suits"), make. |
| pages/Collections.dc.html | `templates/list-collections.json` | Group title with a red underline, then that group's collections as tiles. |
| pages/Collection.dc.html | `templates/collection.json` | Banner with sibling chips, Search & Discovery filters, "Only parts that fit my car" toggle, sort, grid. |
| pages/Product.dc.html | `templates/product.json` | Inline Make/Model/Year fit check, descriptive tags only (hide fitment tags), category links, tabs (Description / Specs / Compatible vehicles / Shipping), "Pair it with". |
| pages/Brands.dc.html | `templates/page.brands.json` + brand results | Brand cards first. Clicking one shows that brand's products with filters, a stock summary and sort. On Shopify, the results can be the vendor collection (`/collections/vendors?q=CRC`) or a collection per brand using the same template. |
| pages/Vehicles.dc.html | `templates/page.vehicles.json` | Make cards first. Clicking a make shows its parts plus universal products, with filters for Fitment, Model, Brand and Product type. Makes and models come from the Supabase fitment data. |
| pages/About.dc.html | `templates/page.about.json` | Contact panel has a button to the Contact page (no form here). Trade accounts show "Coming soon". |
| pages/Contact.dc.html | `templates/page.contact.json` | Uses the ContactForm component. |
| pages/Cart.dc.html | `templates/cart.json` | No free-delivery progress bar. METRO15 code field. Delivery is free at $200 or more. |

## Shared components → sections/snippets

| Design file | Shopify |
|---|---|
| components/Header.dc.html | `sections/header.liquid`: white bar, italic METRO AUTO logo, nav, predictive search, My garage pop-up, METRO15 first-order pop-up, red category bar |
| components/Footer.dc.html | `sections/footer.liquid` |
| components/ProductCard.dc.html | `snippets/product-card.liquid`: stock line ("In stock, N available" / "Only N left" / "Out of stock"), fit badge, sale badge, quantity stepper and Add to cart (AJAX `/cart/add.js`) |
| components/Sidebar.dc.html | Home sidebar section: categories, price slider, top brands |
| components/ContactForm.dc.html | `{% form 'contact' %}` with custom fields: First name, Surname, Email, Mobile, VIN, Rego, State, Message |

## Design tokens

- **Colours:**
  - black `#121316`, panels `#17181B` / `#1F2125`;
  - red `#E1251B` (hover `#B71C14`);
  - grey background `#F4F4F5`, lines `#E4E4E7`, body text `#3F4249`, muted text `#62666D`;
  - green `#15803D` (background `#DCFCE7`), amber for low stock `#B45309`.
- **Brand card colours:** CRC `#1F4FA3`, HiQ `#E1251B`, Goss `#F2B705` (dark text), Penrite `#0F6B3A`, Nulon `#5B2A86`, Hi-Tec `#0E6F78`, Caltex `#121316`.
- **Fonts:** Barlow Condensed 600/700/800 (uppercase headings, prices) and IBM Plex Sans 400–700 (body).
- **Interior page banner:** `radial-gradient(circle at 85% 30%, rgba(225,37,27,0.3), rgba(225,37,27,0) 50%), #121316`, with a 56px condensed uppercase title.
- **Layout:** content max width 1320px. Filter column 260px. Grids are 3 or 4 columns on desktop, 2 on tablet and phone. Filters hide behind a "Filters" button below 900px.

## Behaviour to rebuild in the theme

- **My garage:** the selected vehicle is stored (localStorage, or customer metafields when logged in) and kept across pages. Picking a vehicle goes to search filtered by that vehicle's fitment.
- **Fitment:** product tags look like `toyota-corolla-2019`. They are hidden from the tag chips and used for fit badges, the fit check and the "Compatible vehicles" tab. On the live store they come from the Supabase fitment data.
- **Filters:** use Shopify Search & Discovery filters (`collection.filters` / `search.filters`). The design's left panel shows how they should look.
- **Stock:** show `variant.inventory_quantity`. Show "Only N left" at 5 or fewer, and disable Add to cart at 0.
- **METRO15:** 15% off the first order. The pop-up appears once per visitor, and there is a dashed banner at the end of Home.
- **Placeholders:** text in `[square brackets]` (address, phone, story) needs real content.
- **Images:** product images are SVG placeholders. Use real product images on Shopify.

## Known store issues to fix while porting

- Some CRC compare-at prices in Shopify are wrong.
