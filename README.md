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
- `dist/articles/` contains the Preliminary Declaration and Articles I-XXXVI.
- `dist/identity.html` replaces Article XXXVII as a dedicated identity page.
- `dist/agencies/` and `dist/institutions/` contain unique directory pages.

## Current Navigation

- Institutions: constitutional organs of government, excluding agencies.
- Agencies: authorities, offices, services, programs, registries, and networks.
- Articles: all constitutional articles except Article XXXVII.
- Identity: flag and national animal material from Article XXXVII.
