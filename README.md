# Generational Commonwealth Official Portal

Static Vercel site for the Constitution of the Generational Commonwealth.

## Local Preview

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Structure

- `content/site-data.json` drives the generated pages.
- `scripts/build-site.js` generates `dist/`.
- `assets/generational-commonwealth-flag.png` is the official flag image.
- `dist/articles/` contains the Preliminary Declaration and non-structural Articles I-XXXVI.
- `dist/government/` contains high governmental structures and constitutional courts.
- `dist/identity.html` replaces Article XXXVII as a dedicated identity page.
- `dist/agencies/` contains unique defined agency pages.
- Article pages render complete extracted constitutional text.
- Agency and government pages mirror their establishing article text in contained scrollable panels.

## Current Navigation

- Government: high constitutional structures and courts, excluding agencies.
- Agencies: authorities, offices, services, programs, registries, and networks.
- Articles: non-structural constitutional articles except Article XXXVII.
- Identity: flag and national animal material from Article XXXVII.
