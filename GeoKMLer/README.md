# GeoKMLer / GeoKMZer

A JavaScript library comprising two main components: GeoKMLer and GeoKMZer. These tools are designed to facilitate the conversion of KML data into GeoJSON format and handle the extraction of KML data from KMZ archives efficiently.


## License

This project is free software licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

## Overview

GeoKMLer / GeoKMZer provides a comprehensive API to parse, extract, and convert KML/KMZ files into a GeoJSON FeatureCollection. It is suitable for use in geographic data visualization and web mapping applications.

## Features

- **Convert KML to GeoJSON**: Supports points, linestrings, polygons, and multigeometries through GeoKMLer.
- **Extract KML from KMZ**: Unzip and read KML files from KMZ archives using GeoKMZer.
- **Handle Extended Data**: Converts KML `<ExtendedData>` elements into GeoJSON properties.
- **Robust XML Handling**: Efficient parsing and normalization of XML data.
- **No External Dependencies**: Lightweight and easy to integrate into various projects.

## Usage

GeoKMLer / GeoKMZer makes it easy to work with both KML files directly and KMZ archives.
Here’s how you can use these tools in your application:

### Example for GeoKMLer

```javascript
// @require             https://update.greasyfork.org/scripts/524747/1542062/GeoKMLer.js
// @require             https://update.greasyfork.org/scripts/527113/1538395/GeoKMZer.js

var geoKMLer = new GeoKMLer(); // Create a new instance of GeoKMLer

// Sample KML data input
const kmlData = `...KML data string...`;

// Parse the KML data
const xmlDoc = geoKMLer.read(kmlData);

// Convert to GeoJSON
const geoJson = geoKMLer.toGeoJSON(xmlDoc);

console.log(geoJson);
```

### Example for GeoKMZer

```javascript
(async () => {
    // Assume your KMZ file is loaded and represented as `fileBuffer`

    const fileBuffer = ...; // Load your KMZ file here (e.g., from a fetch request or a file input)

    try {
        // Initialize instances of GeoKMZer and GeoKMLer
        const geoKMZer = new GeoKMZer();
        const geoKMLer = new GeoKMLer();

        // Extract KML contents from the KMZ buffer
        const kmlContentsArray = await geoKMZer.read(fileBuffer);

        // Process each KML and convert to GeoJSON
        kmlContentsArray.forEach(({ filename, content }) => {
            console.log(`Processing file: ${filename}`);
            
            // Parse the KML content
            const kmlDoc = geoKMLer.read(content);
            
            // Convert the KML document to a GeoJSON object
            const geoJson = geoKMLer.toGeoJSON(kmlDoc);

            // Output the GeoJSON to the console
            console.log(`GeoJSON for ${filename}:`, geoJson);
        });

    } catch (error) {
        console.error("Error processing KMZ file:", error);
    }
})();
```

## Key Methods

### GeoKMLer

- read(kmlText): Parses a KML string into an XML Document using DOMParser.
- toGeoJSON(document): Converts an XML Document into a GeoJSON FeatureCollection.
- extractExtendedData(placemark): Extracts extended data from a KML Placemark and includes it as GeoJSON properties.

### GeoKMZer

- read(buffer): Reads a KMZ buffer and extracts KML files.
- unzipKMZ(buffer, parentFile = ''): Unzips a KMZ buffer, potentially recursively, to retrieve KML files.

## Acknowledgments

The structure and logic for this project are based on established methods for XML to GeoJSON conversion, leveraging modern JavaScript best practices.

## Project Home

https://github.com/JS55CT/GeoKMLer
