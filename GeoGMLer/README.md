# GeoGMLer

GeoGMLer is a JavaScript library designed to efficiently convert GML (Geography Markup Language) data into GeoJSON format. It supports a wide range of GML geometries, making it ideal for integrating GML spatial data into web mapping applications and geographic data visualization tools.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

## Overview

GeoGMLer offers a comprehensive API to parse GML files and convert them into a GeoJSON `FeatureCollection`. It is suitable for use in geographic data visualization and web mapping applications, providing support for various geometry types and coordinate reference systems.

## Features

- **Convert GML to GeoJSON**: Supports conversion of Points, LineStrings, Polygons, and complex structures like `gml:MultiCurve` and `gml:MultiSurface` into GeoJSON.
- **CRS Support**: Handles coordinate reference systems by extracting CRS information from GML and utilizing it during conversion.
- **Robust XML Parsing**: Utilizes DOMParser for efficient parsing and handling of XML data, ensuring accurate extraction of geographical features and attributes.
- **Geometry Processing**: Parses and processes both simple and complex geometries, including multi-geometries.
- **No External Dependencies**: Lightweight and easy to integrate into various projects without requiring additional libraries.

## Usage

To use GeoGMLer, create an instance of `GeoGMLer` and utilize its methods to perform conversions from GML strings to GeoJSON objects.

### Example

```javascript
// @require             https://update.greasyfork.org/scripts/526229/1537672/GeoGMLer.js

var geoGMLer = new GeoGMLer(); // Create a new instance of GeoGMLer

// Sample GML data input
const gmlData = `...GML data string...`;

// Parse the GML data
const { xmlDoc, crsName } = geoGMLer.read(gmlData);

// Convert to GeoJSON
const geoJson = geoGMLer.toGeoJSON({ xmlDoc, crsName });

console.log(geoJson);
```

## Key Methods

- read(gmlText): Parses a GML string into an XML Document and extracts the CRS using DOMParser.
- toGeoJSON({ xmlDoc, crsName }): Converts a parsed XML Document along with CRS information into a GeoJSON FeatureCollection.
- getFeatureEleProperties(featureEle): Extracts properties from a GML feature element.
- processMultiSurface(multiSurfaceElement, crsName): Processes gml:MultiSurface elements to extract polygon data.
- processMultiCurve(multiCurveElement, crsName): Processes gml:MultiCurve elements to extract line string data.

## Acknowledgments

The structure and logic for this project are based on established methods for converting XML to GeoJSON, utilizing modern JavaScript practices for handling geographic data.  
Project was inspired by the work of [gml2geojson](https://github.com/deyihu/gml2geojson) (MIT licensed) and builds upon the concepts and implementations found there.

## Project Home

https://github.com/YourUsername/GeoGMLer
