# GeoWKTer: WKT to GeoJSON Converter

GeoWKTer is a JavaScript library designed to facilitate the conversion of Well-Known Text (WKT) geometries into GeoJSON format. This library is especially beneficial for developers and GIS specialists working with geographic data across varying standards. By implementing robust methods for parsing and conversion, GeoWKTer ensures seamless transitions between WKT and GeoJSON representations.

## Features

- **Support for Various WKT Types**: Accurately converts diverse geometry types, including `POINT`, `LINESTRING`, `POLYGON`, `MULTIPOINT`, `MULTILINESTRING`, `MULTIPOLYGON`, and `GEOMETRYCOLLECTION`.
- **Streamlined API**: Provides a simple and intuitive interface for converting WKT inputs into GeoJSON `FeatureCollections`.

## Usage

Below is a basic example of how to use the GeoWKTer library:

```javascript
// @require             https://update.greasyfork.org/scripts/523986/1575829/GeoWKTer.js

// Initialize the GeoWKTer instance
let geoWKTer = new GeoWKTer();

// Example WKT input
let wktText = "GEOMETRYCOLLECTION(POINT(4 6), LINESTRING(4 6, 7 10))";

// Convert WKT to GeoJSON
let wktDataArray = geoWKTer.read(wktText, 'Example Label');
let geoJsonData = geoWKTer.toGeoJSON(wktDataArray);

// Output GeoJSON
console.log(JSON.stringify(geoJsonData, null, 2));
```

## API

### GeoWKTer

- **read(wktText, label):** 
  - **Description**: Parses a WKT string into an array of geometry objects. Assigns a specified label to each parsed geometry.
  - **Parameters**:
    - `wktText` (string): The Well-Known Text string representing the geometries.
    - `label` (string): An optional label to associate with the geometries for identification or classification.

- **toGeoJSON(dataArray):**
  - **Description**: Converts an array of parsed WKT data into a GeoJSON `FeatureCollection`.
  - **Parameters**:
    - `dataArray` (Object[]): The internal data array produced by the `read` method, ready for transformation into GeoJSON format.

## License

GeoWKTer is licensed under the MIT License. For more details, please see the [LICENSE](LICENSE) file.

## Acknowledgments

GeoWKTer is also inspired by the work of [Wicket.js](https://github.com/arthur-e/Wicket) and [Terraformer](https://github.com/terraformer-js/terraformer/tree/main).
