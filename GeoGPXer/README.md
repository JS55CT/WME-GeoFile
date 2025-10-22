# GeoGPXer

GeoGPXer is a JavaScript library designed to convert GPX data into GeoJSON format efficiently. It supports the conversion of waypoints, tracks, and routes, with additional handling for GPX extensions.

## License

This project is free software licensed under the GNU LESSER GENERAL PUBLIC LICENS v3. See the [LICENSE](LICENSE) file for more details.

## Overview

GeoGPXer provides an easy-to-use API to parse GPX files and convert them into a GeoJSON FeatureCollection, making it suitable for use in web mapping applications and geographic data visualization.

## Features

- **Convert GPX to GeoJSON**: Supports waypoints, tracks, and routes.
- **Handle Extensions**: Converts GPX `<extensions>` to prefixed GeoJSON properties to avoid conflicts.
- **No External Dependencies**: Lightweight and easy to integrate into various projects.

## Usage

To use GeoGPXer, create an instance of `GeoGPXer` and use its methods to perform the conversion from GPX strings to GeoJSON objects.

### Example

```javascript
// @require             https://update.greasyfork.org/scripts/523870/1534525/GeoGPXer.js

var geoGPXer = new GeoGPXer(); // Create a new instance of GeoGPXer

// Sample GPX data input
const gpxData = `...GPX data string...`;

// Parse the GPX data
const xmlDoc = geoGPXer.read(gpxData);

// Convert to GeoJSON
const geoJson = geoGPXer.toGeoJSON(xmlDoc);

console.log(geoJson);
```

## Key Methods
- read(gpxText): Parses a GPX string into an XML Document using DOMParser.
- toGeoJSON(document): Converts an XML Document into a GeoJSON FeatureCollection.
- extractProperties(node): Extracts properties from a GPX node, including handling of <extensions> by prefixing property names.

## Acknowledgments
The code in this project is derived from the logic of [gpx2geojson](https://github.com/M-Reimer/gpx2geojson) by M-Reimer.

## Project Home
https://github.com/JS55CT/GeoGPXer
