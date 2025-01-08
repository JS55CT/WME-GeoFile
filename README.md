# WME Geometry (JS55CT Forked)

WME Geometry File Importer allows you to import various geometry files (supported formats: GeoJSON, GML, WKT, KML, and GPX) into the Waze Map Editor (WME). The script enhances the mapping utilities offered by WME by overlaying geospatial data directly onto the maps.

## Table of Contents

- [WME Geometry (JS55CT Forked)](#wme-geometry-js55ct-forked)
  - [Table of Contents](#table-of-contents)
  - [About](#about)
  - [Installation](#installation)
    - [Add the Script via URL - Tampermonkey (Recommended)](#add-the-script-via-url---tampermonkey-recommended)
    - [Add the Script via URL via Greasemonkey](#add-the-script-via-url-via-greasemonkey)
  - [Usage](#usage)
  - [Enhancements](#enhancements)
  - [Attribution](#attribution)
  - [License](#license)

## About

The WME Geometry File Importer allows Waze map editors to benefit from importing external geometry files for better navigation and map editing. It supports various widely-used formats and enables detailed customization of how these geometries are presented in the editor.

## Installation

To install this user script, you need to have a userscript manager installed in your browser (such as Tampermonkey or Greasemonkey).

### Add the Script via URL - Tampermonkey (Recommended)

- Open the Tampermonkey dashboard by clicking on the Tampermonkey icon in your browser toolbar and selecting **"Dashboard"**.
- In the dashboard, click on the tab that says **"Utilities"**.
- In the **"Import from URL"** section, paste the following URL

``` https://raw.githubusercontent.com/JS55CT/WME-Geometries-JS55CT-Fork/main/WME%20Geometries.js ```

- Click on the **"Import"** button.
- ou will be directed to a page that shows the script. Click the **"Install"** button.

### Add the Script via URL via Greasemonkey

- Open Greasemonkey by clicking on the Greasemonkey icon in the browser toolbar and selecting **"Manage User Scripts"**.
- Click on the **"New User Script"** button.
- In the script editor that opens, click on the **"Import from URL"** button.
- Paste the following URL into the dialog that appears:

``` https://raw.githubusercontent.com/JS55CT/WME-Geometries-JS55CT-Fork/main/WME%20Geometries.js ```

- Click **"OK"** and then **"Install"** the script.

## Usage

Once the script is installed and running, it will add a 'GEO' tab to the WME sidebar. You can use this tab to:

- Import geometry files by selecting them from your computer.
- Customize how these geometry files are displayed on the map (color, font size, fill opacity, line style, and label positions).
- Clear all imported layers or selectively remove items.
- Import Well-Known Text (WKT) directly into the editor.
- Draw state boundaries based on the state in focus within WME.

## Enhancements

Relative to the original code by Timbones, the following enhancements have been made:

1. **User Interface Improvements**:
   - Added a user-friendly GEO tab within the WME Scripts sidebar for managing geometry imports and settings.
   - Added styling to form elements (buttons, sliders, labels, etc.) for a better user experience.
   - Added user input section for label value for Geo Files (GeoJSON, KML, etc) that have attributes.

2. **Customization Options**:
   - Added options for customizing layer properties such as color, font size, fill opacity, line style, and label positions.
   - Enhanced label mechanics to display labels based on customizable conditions.

3. **State Boundary Drawing**:
   - Included state boundary drawing functionality with customizable layer formatting that persists in local storage.

4. **Layer Management**:
   - Added options to clear imported layer individually.
   - Added layers to WME Geometries section in the WME Map Layers sidebar to allow for hiding/showing of each layer individually.
   - Added local storage compression for efficient data storage of imported layers.

5. **Improved File Handling**:
   - Streamlined the file import process with improved error handling for unsupported file formats.
   - Automatically converts WKT input to GeoJSON before rendering for easier integration with WME.
   - Supports Multi Line WKT files!

6. **Enhanced Label Management**:
   - Improved label handling, including finer control over label positioning and styling.

## Attribution

This script is based on the original `WME Geometries` script by Timbones and contributors.

- **Original Author**: Timbones
  - [Greasy Fork Profile](https://greasyfork.org/users/3339)

- **Contributors**:
  - wlodek76
  - Twister-UK

## License

This project is licensed under the MIT License - see the LICENSE.md file for details.
