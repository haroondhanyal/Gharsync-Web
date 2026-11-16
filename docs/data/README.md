# Signup location data

The sign-up country picker lists all 249 ISO country/territory codes with Unicode flag emoji. City suggestions are served locally from `apps/web/public/data/cities/`, one JSON file per country; the browser fetches only the selected country’s list and still accepts a manually entered city.

The city names are generated from GeoNames’ `cities500.zip` extract, which contains populated places above 500 people or administrative seats. The checked-in data contains about 209,000 place names across 246 country codes. It is grouped by ISO country code, deduplicated and alphabetically sorted by [scripts/build-geonames-city-data.mjs](../../scripts/build-geonames-city-data.mjs). Very small territories without entries remain usable because the city field accepts typed values.

GeoNames data is used under **CC BY 4.0**. Attribution: “City data from [GeoNames](https://www.geonames.org/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).” Source archive: <https://download.geonames.org/export/dump/cities15000.zip>.
