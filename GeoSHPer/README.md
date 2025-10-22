# GeoSHPer

GeoSHPer is a JavaScript library designed to convert shapefile data into GeoJSON format effortlessly. It reads ZIP archives containing various components of shapefiles (.shp, .dbf, and .prj files), parses geographic features and attributes, and supports coordinate transformations using Proj4js. The final result is a GeoJSON FeatureCollection, which can be easily integrated with web mapping libraries.

## Features

- **Convert Shapefile to GeoJSON**: Reads compressed shapefile formats and outputs GeoJSON, a standard format used by mapping libraries.
- **Coordinate Transformation**: Utilize Proj4js to handle complex map projections.
- **Support for Multi-layer Files**: Automatically processes multiple shapefile layers within a single ZIP archive.
- **Parsing Support**: Extracts data from .shp (geometry), .dbf (attributes), and .prj (projection information) files.

## Installation Dependency

To use GeoSHPer, you need to include the Proj4js library as a dependency:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.15.0/proj4-src.js"></script>
```
or via Tamplermonkey / GreasyFork

```html
// @require  https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.15.0/proj4-src.js
```

## Usage

### Basic Example

Here is a simple example of how to use GeoSHPer to convert shapefile data to GeoJSON:

```javascript
// @require  https://update.greasyfork.org/scripts/526996/1537647/GeoSHPer.js
// @require  https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.15.0/proj4-src.js

(async () => {
    const response = await fetch('path/to/your/shapefile.zip');
    const buffer = await response.arrayBuffer();

    const geoSHPer = new GeoSHPer();
    await geoSHPer.read(buffer);
    const geoJSON = geoSHPer.toGeoJSON();
    console.log(geoJSON);
})();
```

### Handling Different Encodings

GeoSHPer supports different string encoding formats specified in .cpg files for .dbf attributes.

```javascript
// Assuming a `.cpg` file exists in your .zip providing character encoding details.
```

## Error Handling

GeoSHPer provides error messages for common issues:
- Forgot buffer: "forgot to pass buffer"
- Invalid buffer: "invalid buffer like object"
- Missing shapefile layers: "no layers found"

Ensure you handle these errors appropriately in your application.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Dependencies

- [Proj4js](http://proj4js.org/) (MIT License) - For map projection transformations.

## Acknowledgments

GeoSHPer builds upon foundational work from:
- [shpjs](https://github.com/calvinmetcalf/shapefile-js) (MIT License)

Each library is subject to its own license and must be used in accordance with their respective terms. This code adapts and extends functionalities from shpjs to convert shapefile data into GeoJSON.


## Contact

Created by JS55CT - [GitHub](https://github.com/JS55CT)
