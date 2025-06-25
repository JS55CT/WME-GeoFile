// geoWKTTest.js

// Assuming GeoWKTer class is imported or defined here
// const GeoWKTer = require('./path/to/GeoWKTer'); // Import if needed

function runGeoWKTTests(GeoWKTer) {
    // Instantiate the GeoWKTer
    const geoWKT = new GeoWKTer();
  
    const testCases = [
      "POINT (-72.7000 41.5000)",
      `LINESTRING (
        -72.9300 41.3100,
        -72.7800 41.6700,
        -72.6500 41.9100
      )`,
      `POLYGON ((
        -73.4860 42.0520,
        -73.7040 40.9860,
        -72.0540 41.0610,
        -71.7980 42.0390,
        -73.4860 42.0520
      ))`,
      `MULTIPOINT (
        (-72.9279 41.3083),
        (-72.6734 41.7658),
        (-72.7420 41.7621)
      )`,
      `MULTIPOINT (
        -72.9279 41.3083,
        -72.6734 41.7658,
        -72.7420 41.7621
      )`,
      `MULTILINESTRING (
        (
          -72.3500 41.4500,
          -72.8500 41.7500
        ),
        (
          -73.4500 41.3000,
          -72.9500 41.8500
        )
      )`,
      `MULTIPOLYGON (
        (
          (
            -73.1000 41.9000,
            -72.9000 41.8000,
            -73.0000 41.9000,
            -73.1000 41.9000
          )
        ),
        (
          (
            -72.8000 41.5000,
            -72.8000 41.6000,
            -72.7000 41.6000,
            -72.7000 41.5000,
            -72.8000 41.5000
          )
        )
      )`,
      `GEOMETRYCOLLECTION (
        POINT (-72.6734 41.7658),
        LINESTRING (
          -72.3000 41.3000,
          -72.8000 41.5000
        ),
        POLYGON ((
          -73.4860 42.0520,
          -73.7040 40.9860,
          -72.0540 41.0610,
          -71.7980 42.0390,
          -73.4860 42.0520
        ))
      )`,
    ];
  
    testCases.forEach((testCase, index) => {
      try {
        // Clean the WKT string
        const cleanedWKT = geoWKT.cleanWKTString(testCase);
  
        // Convert cleaned WKT to internal representation
        const internalRepresentation = geoWKT.read(cleanedWKT, `Sample Label ${index + 1}`);
  
        // Convert to GeoJSON
        const geoJSON = geoWKT.toGeoJSON(internalRepresentation);
  
        // Log all information in one console.log statement
        console.log(`Test Case ${index + 1}:\nCleaned WKT: ${cleanedWKT}\nInternal Representation: ${JSON.stringify(internalRepresentation, null, 2)}\nGeoJSON Output: ${JSON.stringify(geoJSON, null, 2)}`);
      } catch (error) {
        console.error(`Error processing WKT for Test Case ${index + 1}:`, error.message);
      }
    });
  }
  
  // Export the function
  module.exports = runGeoWKTTests;