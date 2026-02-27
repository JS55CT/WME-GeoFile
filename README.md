# WME GeoFile

WME GeoFile is a File Importer that allows you to import various geometry files (supported formats: GeoJSON, KML, WKT, GML, GPX, shapefiles(SHP,SHX,DBF).ZIP) into the Waze Map Editor (WME). The script enhances the mapping utilities offered by WME by overlaying geospatial data directly onto the maps.

## Table of Contents

- [WME GeoFile](#wme-geofile)
  - [Table of Contents](#table-of-contents)
  - [Usage](#usage)
  - [Enhancements](#enhancements)
  - [Attribution](#attribution)


## Usage

Once the script is installed and running, it will add a 'GEO' tab to the WME sidebar. You can use this tab to:

- Import geometry files by selecting them from your computer.
- Customize how these geometry files are displayed on the map — stroke color, font size, fill opacity, line size/style, label color, label outline color & width, and label position.
- **Edit any loaded layer's style** after import by clicking its name in the Loaded Files list to open the Edit Style Dialog, then clicking "Apply Changes" to redraw the layer instantly.
- Clear all imported layers or selectively remove items.
- Import Well-Known Text (WKT) directly into the editor via the GEO tab import functionality.
- Draw state, county, county-sub & zip code boundaries based on the area in focus within WME (U.S. Only).

## Enhancements

Built on the original code by Timbones:

1. **User Interface Improvements**:
   - Added a user-friendly GEO tab within the WME Scripts sidebar for managing geometry imports and settings.
   - Enhanced styling to form elements (buttons, sliders, labels, etc.) for a better user experience.

2. **Customization Options**:
   - Added options for customizing layer properties such as stroke color, font size, fill opacity, line size/style, and label position.
   - **Label Color**: Choose a custom label text color or toggle "Match stroke" to keep it in sync with the stroke color.
   - **Label Outline Color**: Choose a custom label outline color (default black) or toggle "Match stroke". Provides contrast so labels remain readable over any background.
   - **Label Outline Width**: Set a fixed pixel width or toggle "Relative to Font Size" (default ON) to automatically compute the width as `font size ÷ 4`, scaling proportionally as font size changes.

3. **State / County / County-Sub and ZIP Code Boundary Drawing**:
   - Available only if WME is started with the Top Level Country of the U.S. - Data source is US Census Bureau.

4. **"Whats in View" Feature**:
   - Introduced a new draggable overlay that displays geographic data visible on the map, including states, counties, towns, and ZIP codes.
   - The overlay updates dynamically to reflect changes in the map view, providing insights into the currently visible areas.
   - Geographical entities are listed in a structured, sorted manner for easy reference.

5. **Layer Management**:
   - Added options to clear imported layers individually.
   - Incorporated layers into the WME Geometries section in the WME Map Layers sidebar, allowing for the visibility toggling of each layer independently.
   - Implemented IndexedDB for enhanced performance, enabling efficient data storage and management of larger files compared to standard local storage methods.

6. **Improved File Handling**:
   - Streamlined the file import process with improved error handling for unsupported file formats.
   - Automatically converts WKT input to GeoJSON before rendering for easier integration with WME.
   - Supports Multi Line WKT files.
   - Automatically converts GPX input including the `<extension>` tags to GeoJSON before rendering for easier integration with WME.
   - Automatically converts ESRI Shapefiles in .ZIP format to GeoJSON before rendering for easier integration with WME.

7. **Support for Projection Transformations**:
   - Integrated PROJ4js library to facilitate transformations between different coordinate reference systems.
   - Supports a wide array of EPSG codes including: 
     - **EPSG**: 3035, 3414, 4214, 4258, 4267, 4283, 4326, 25832, and series 26901->26923, 27700, 32601->32660, 32701->32760.
   - Automatically handles all transformations from SHP Zip files that contain a `.prj` file, ensuring accurate mapping and data representation on the WME platform.

8. **Edit Style Dialog**:
   - Click any layer name in the **Loaded Files** list to open a floating, draggable **Edit Style** popup pre-populated with that layer's current stored values.
   - All style properties can be adjusted: stroke color, font size, label color, outline color, outline width, fill opacity, line size/style/opacity, and label position.
   - Click **Apply Changes** to redraw the layer on the map instantly — no re-import required. The updated style is persisted to IndexedDB and will reload correctly on the next WME session.
   - Attempting to import a new file while the dialog is open shows a warning; close or cancel the dialog first.

9. **Enhanced Label Management**:
   - Improved label handling, including finer control over label positioning and styling.
   - Custom Labels: You can define custom labels using placeholders for dynamic values.

   **Creating Custom Labels**:
   - Enter your custom label using `${attributeName}` for dynamic values.
     - **Feature Example**:
       - **Attributes**:
         - BridgeNumber: 01995
         - FacilityCarried: U.S. ROUTE 6
         - FeatureCrossed: BIG RIVER
     - **Example 1 (explicit new lines formatting)**:
       ```
       #:${BridgeNumber}\\n${FacilityCarried} over\\n${FeatureCrossed}
       ```
     - **Example 2 (multi-line formatting)**:
       ```
       #:${BridgeNumber}
       ${FacilityCarried} over
       ${FeatureCrossed}
       ```

   **Expected Output**:
     ```
     #:01995
     U.S. ROUTE 6 over
     BIG RIVER
     ```

## Attribution

This script is based on the original "[WME Geometries](https://greasyfork.org/en/scripts/8129-wme-geometries/code?version=1284539)" script by Timbones and contributors.

- **Original Author**: Timbones
  - [Greasy Fork Profile](https://greasyfork.org/users/3339)

- **Contributors**:
  - wlodek76
  - Twister-UK
