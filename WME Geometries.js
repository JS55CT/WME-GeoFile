// ==UserScript==
// @name                WME Geometries (JS55CT Fork)
// @namespace           https://github.com/JS55CT
// @description         Import geometry files into Waze Map Editor. Supports GeoJSON, GML, WKT, KML, and GPX (Modified from original).
// @version             2025.01.22.01
// @downloadURL         https://raw.githubusercontent.com/JS55CT/WME-Geometries-JS55CT-Fork/main/WME%20Geometries.js
// @updateURL           https://raw.githubusercontent.com/JS55CT/WME-Geometries-JS55CT-Fork/main/WME%20Geometries.js
// @author              JS55CT
// @match               https://www.waze.com/*/editor*
// @match               https://www.waze.com/editor*
// @match               https://beta.waze.com/*
// @exclude             https://www.waze.com/*user/*editor/*
// @require             https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js
// @require             https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @require             https://cdnjs.cloudflare.com/ajax/libs/openlayers/2.13.1/lib/OpenLayers/Format/KML.js
// @require             https://cdnjs.cloudflare.com/ajax/libs/openlayers/2.13.1/lib/OpenLayers/Format/GML.js
// @require             https://cdnjs.cloudflare.com/ajax/libs/openlayers/2.13.1/lib/OpenLayers/Format/OSM.js
// @require             https://update.greasyfork.org/scripts/523986/1521862/GeoWKTer.js
// @require             https://update.greasyfork.org/scripts/523870/1521199/GeoGPXer.js
// @require             https://cdnjs.cloudflare.com/ajax/libs/shpjs/6.1.0/shp.js
// @grant               none
// @license             MIT
// @original-author     Timbones
// @original-contributors wlodek76, Twister-UK
// @original-source     https://greasyfork.org/en/scripts/8129-wme-geometries
// ==/UserScript==

/********
 * TO DO LIST:
 *  1. Update Labels for line feachers for pathLabel? and pathLabelCurve?  Need to understand installPathFollowingLabels() more.
 *********/

var geometries = function () {
  "use strict";
  const scriptMetadata = GM_info.script;
  const scriptName = scriptMetadata.name;
  let maxlabels = 100000; // maximum number of features that will be shown with labels

  let geolist;
  let debug = false;

  let { formats, formathelp } = createLayersFormats();

  let layerindex = 0;
  let storedLayers = [];
  let groupToggler;

  function layerStoreObj(fileContent, color, fileext, filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, labelattribute, orgFileext) {
    this.fileContent = fileContent;
    this.color = color;
    this.fileext = fileext;
    this.filename = filename;
    this.fillOpacity = fillOpacity;
    this.fontsize = fontsize;
    this.lineopacity = lineopacity;
    this.linesize = linesize;
    this.linestyle = linestyle;
    this.labelpos = labelpos;
    this.labelattribute = labelattribute;
    this.orgFileext = orgFileext;
  }

  /*************************************************************************************
   * loadLayers
   *
   * Description:
   * Loads and initializes geometrical layers from local storage into the current map environment. This function retrieves
   * saved layers and processes each one to ensure they are displayed correctly on the map.
   *
   * Behavior:
   * - Checks if any geometrical data is stored in `localStorage` under the key `WMEGeoLayers`.
   * - If present, decompresses and parses the stored string into the `storedLayers` array.
   * - Iterates over each stored layer, applying the `parseFile` function to render them in the map interface.
   * - Initializes `storedLayers` as an empty array if no data is found in local storage.
   * - Logs the loading process in the console for traceability.
   *
   * Notes:
   * - Assumes the existence of the `LZString` library for decompression and the `parseFile` function for layer processing.
   * - Utilizes a global `storedLayers` array to maintain the state of loaded layers throughout the session.
   *********************************************************************************/
  function loadLayers() {
    // Parse any locally stored layer objects
    if (localStorage.WMEGeoLayers != undefined) {
      console.log(`${scriptName}: Loading Saved Layers ...`);
      storedLayers = JSON.parse(LZString.decompress(localStorage.WMEGeoLayers));
      for (layerindex = 0; layerindex < storedLayers.length; ++layerindex) {
        parseFile(storedLayers[layerindex]);
      }
    } else {
      storedLayers = [];
    }
  }

  /*********************************************************************
   * init
   *
   * Description:
   * Initializes the user interface for the "WME Geometries" sidebar tab in the Waze Map Editor. This function sets up
   * the DOM structure, styles, event listeners, and interactions necessary for importing and working with geometric
   * files and Well-Known Text (WKT) inputs.
   *
   * Parameters:
   * - This function does not take any direct parameters but interacts with global objects and the document's DOM.
   *
   * Behavior:
   * - Registers a new sidebar tab labeled "GEO" using Waze's userscript API.
   * - Builds a user interface dynamically, adding elements such as title sections, file inputs, and buttons for importing
   *   and clearing WKT data.
   * - Configures event listeners for file input changes and button clicks to handle layer management and WKT drawing.
   * - Sets default styles and hover effects for UI components to enhance user experience.
   * - Displays information about available formats and coordinate systems to guide users in their inputs.
   * - Ensures that the existing layers are loaded upon initialization by calling a separate function, `loadLayers`.
   * - Provides console logging to trace the steps and confirm successful loading of the UI, with debug messages when applicable.
   *
   * Notes:
   * - Relies on global variables and elements such as `W.userscripts`, `W.map`, and custom functions like `addGeometryLayer`, `drawStateBoundary`, and `draw_WKT`.
   * - Incorporates CSS styling to maintain consistency with the WME environment and improve usability.
   *************************************************************************/
  function init() {
    console.log(`${scriptName}: init() called .... Loading User Interface ...`);

    const { tabLabel, tabPane } = W.userscripts.registerSidebarTab("WME Geometries");
    tabLabel.innerText = "GEO";
    W.userscripts.waitForElementConnected(tabPane).then(() => {
      let geobox = document.createElement("div");
      geobox.style.padding = "10px";
      geobox.style.backgroundColor = "#fff";
      geobox.style.border = "2px solid #ddd";
      geobox.style.borderRadius = "10px";
      geobox.style.boxShadow = "2px 2px 10px rgba(0, 0, 0, 0.1)";
      tabPane.appendChild(geobox);

      let geotitle = document.createElement("div"); //legend
      geotitle.innerHTML = GM_info.script.name;
      geotitle.style.textAlign = "center";
      geotitle.style.fontSize = "1.1em";
      geotitle.style.fontWeight = "bold";
      geotitle.style.color = "#222";
      geobox.appendChild(geotitle);

      let geoversion = document.createElement("div");
      geoversion.innerHTML = "v " + GM_info.script.version;
      geoversion.style.textAlign = "center";
      geoversion.style.fontSize = "0.9em";
      geoversion.style.color = "#222";
      geobox.appendChild(geoversion);

      let hr = document.createElement("hr");
      hr.style.marginTop = "5px";
      hr.style.marginBottom = "5px";
      hr.style.border = "0";
      hr.style.borderTop = "1px solid hsl(0, 0%, 93.5%)";
      geobox.appendChild(hr);

      geolist = document.createElement("ul");
      geolist.style.margin = "5px 0";
      geolist.style.padding = "5px";
      geobox.appendChild(geolist);

      let geoform = document.createElement("form");
      geoform.style.display = "flex";
      geoform.style.flexDirection = "column";
      geoform.style.gap = "0px";
      geoform.id = "geoform"; // added for refrance in WKT text Area
      geobox.appendChild(geoform);

      // Create the container div
      let fileContainer = document.createElement("div");
      fileContainer.style.position = "relative";
      fileContainer.style.display = "inline-block";

      // Create the input element
      let inputfile = document.createElement("input");
      inputfile.type = "file";
      inputfile.id = "GeometryFile";
      inputfile.title = ".geojson, .gml or .wkt";

      // Hide the actual input file element
      inputfile.style.opacity = "0";
      inputfile.style.position = "absolute";
      inputfile.style.top = "0";
      inputfile.style.left = "0";
      inputfile.style.width = "100%";
      inputfile.style.height = "100%";
      inputfile.style.cursor = "pointer";
      inputfile.style.pointerEvents = "none"; // Prevents inputfile from capturing events

      // Create the custom label using the createButton function
      let customLabel = createButton("Import GEO File", "#8BC34A", "#689F38", "label", "GeometryFile");

      // Append the input file and custom label to the container
      fileContainer.appendChild(inputfile);
      fileContainer.appendChild(customLabel);

      // Append the container to the form
      geoform.appendChild(fileContainer);

      // Add change event listener to the input file
      inputfile.addEventListener("change", addGeometryLayer, false);

      let notes = document.createElement("p");
      notes.innerHTML = "<b>Formats:</b> " + formathelp + "<br> <b>EPSG:</b> 4326 | 4269 | 3857 | 3035 | 4267 |";
      notes.style.color = "#555";
      notes.style.display = "block";
      notes.style.fontSize = "0.9em";
      notes.style.marginLeft = "0px";
      notes.style.marginBottom = "0px";
      geoform.appendChild(notes);

      // Create the Draw State Boundary Button
      let stateBoundaryButton = createButton("Draw State Boundary", "#87CEEB", "#4D9DD2", "input");
      stateBoundaryButton.id = "stateBoundary_btn";
      stateBoundaryButton.title = "Add boundary for Current Active State";
      stateBoundaryButton.addEventListener("click", drawStateBoundary);
      geoform.appendChild(stateBoundaryButton);

      // Create a container for the color, font size, and fill opacity input fields
      let inputContainer = document.createElement("div");
      inputContainer.style.display = "flex";
      inputContainer.style.flexDirection = "column";
      inputContainer.style.gap = "5px";
      inputContainer.style.marginTop = "10px"; // Add space at the top

      // Adding a horizontal break before Color and Font Size Position
      let hrElement1 = document.createElement("hr");
      hrElement1.style.margin = "5px 0"; // Adjust margin to reduce vertical space
      hrElement1.style.border = "0"; // Remove default border
      hrElement1.style.borderTop = "1px solid #ddd"; // Add custom border
      inputContainer.appendChild(hrElement1);

      // Row for color and font size inputs
      let colorFontSizeRow = document.createElement("div");
      colorFontSizeRow.style.display = "flex";
      colorFontSizeRow.style.justifyContent = "normal";
      colorFontSizeRow.style.alignItems = "center";
      colorFontSizeRow.style.gap = "0px"; // Space between the inputs

      // Color input
      let input_color_label = document.createElement("label");
      input_color_label.setAttribute("for", "color");
      input_color_label.innerHTML = "Color: ";
      input_color_label.style.fontWeight = "normal";
      input_color_label.style.flexShrink = "0"; // Prevent the label from shrinking
      input_color_label.style.marginRight = "5px"; // Add space between the label and input box

      let input_color = document.createElement("input");
      input_color.type = "color";
      input_color.id = "color";
      input_color.value = "#00bfff";
      input_color.name = "color";
      input_color.style.width = "60px"; // Increase the width of the color input

      // Font Size
      let input_font_size_label = document.createElement("label");
      input_font_size_label.setAttribute("for", "font_size");
      input_font_size_label.innerHTML = "Font Size: ";
      input_font_size_label.style.marginLeft = "40px";
      input_font_size_label.style.fontWeight = "normal";
      input_font_size_label.style.flexShrink = "0"; // Prevent the label from shrinking
      input_font_size_label.style.marginRight = "5px"; // Add space between the label and input box

      let input_font_size = document.createElement("input");
      input_font_size.type = "number";
      input_font_size.id = "font_size";
      input_font_size.min = "0";
      input_font_size.max = "20";
      input_font_size.name = "font_size";
      input_font_size.value = "12";
      input_font_size.step = "1.0";
      input_font_size.style.width = "50px"; // Decrease the width of the font size input
      input_font_size.style.textAlign = "center"; // Center the text inside the input box

      // Append elements to the color and font size row
      colorFontSizeRow.appendChild(input_color_label);
      colorFontSizeRow.appendChild(input_color);
      colorFontSizeRow.appendChild(input_font_size_label);
      colorFontSizeRow.appendChild(input_font_size);

      // Append the color and font size row to the input container
      inputContainer.appendChild(colorFontSizeRow);

      // Row for fill opacity input
      let fillOpacityRow = document.createElement("div");
      fillOpacityRow.style.display = "flex";
      fillOpacityRow.style.flexDirection = "column";

      // Polygon Fill Opacity
      let input_fill_opacity_label = document.createElement("label");
      input_fill_opacity_label.setAttribute("for", "fill_opacity");
      input_fill_opacity_label.innerHTML = `Fill Opacity % [${(0.05 * 100).toFixed()}]`;
      input_fill_opacity_label.style.fontWeight = "normal";

      let input_fill_opacity = document.createElement("input");
      input_fill_opacity.type = "range";
      input_fill_opacity.id = "fill_opacity";
      input_fill_opacity.min = "0";
      input_fill_opacity.max = "1";
      input_fill_opacity.step = "0.01";
      input_fill_opacity.value = "0.05";
      input_fill_opacity.name = "fill_opacity";
      input_fill_opacity.style.width = "100%";

      // Apply modern styling to the range input
      input_fill_opacity.style.appearance = "none";
      input_fill_opacity.style.height = "12px";
      input_fill_opacity.style.borderRadius = "5px";
      input_fill_opacity.style.outline = "none";

      // Thumb styling via CSS pseudo-elements
      const styleElement = document.createElement("style");
      styleElement.textContent = `
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 15px; /* Thumb width */
          height: 15px; /* Thumb height */
          background: #808080; /* Thumb color */
          cursor: pointer; /* Switch cursor to pointer when hovering the thumb */
          border-radius: 50%;
        }
          input[type=range]::-moz-range-thumb {
          width: 15px;
          height: 15px;
          background: #808080;
          cursor: pointer;
          border-radius: 50%;
        }
          input[type=range]::-ms-thumb {
          width: 15px;
          height: 15px;
          background: #808080;
          cursor: pointer;
          border-radius: 50%;
        }
      `;

      document.head.appendChild(styleElement);

      // Initialize with the input color's current value and opacity
      let updateOpacityInputStyles = () => {
        let color = input_color.value;
        let opacityValue = input_fill_opacity.value;
        let rgbaColor = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${opacityValue})`;

        // Update the background color with opacity
        input_fill_opacity.style.backgroundColor = rgbaColor;
        input_fill_opacity.style.border = `2px solid ${color}`;
      };

      updateOpacityInputStyles();

      // Event listener to update the label dynamically
      input_fill_opacity.addEventListener("input", function () {
        input_fill_opacity_label.innerHTML = `Fill Opacity % [${Math.round(this.value * 100)}]`;
        updateOpacityInputStyles();
      });

      // Append elements to the fill opacity row
      fillOpacityRow.appendChild(input_fill_opacity_label);
      fillOpacityRow.appendChild(input_fill_opacity);

      // Append the fill opacity row to the input container
      inputContainer.appendChild(fillOpacityRow);

      // Section for line stroke settings
      let lineStrokeSection = document.createElement("div");
      lineStrokeSection.style.display = "flex";
      lineStrokeSection.style.flexDirection = "column";
      lineStrokeSection.style.marginTop = "10px";

      // Line stroke section label
      let lineStrokeSectionLabel = document.createElement("span");
      lineStrokeSectionLabel.innerText = "Line Stroke Settings:";
      lineStrokeSectionLabel.style.fontWeight = "bold";
      lineStrokeSectionLabel.style.marginBottom = "10px";
      lineStrokeSection.appendChild(lineStrokeSectionLabel);

      // Line Stroke Size
      let lineStrokeSizeRow = document.createElement("div");
      lineStrokeSizeRow.style.display = "flex";
      lineStrokeSizeRow.style.alignItems = "center";

      let line_stroke_size_label = document.createElement("label");
      line_stroke_size_label.setAttribute("for", "line_size");
      line_stroke_size_label.innerHTML = "Size:";
      line_stroke_size_label.style.fontWeight = "normal";
      line_stroke_size_label.style.marginRight = "5px";

      let line_stroke_size = document.createElement("input");
      line_stroke_size.type = "number";
      line_stroke_size.id = "line_size";
      line_stroke_size.min = "0";
      line_stroke_size.max = "10";
      line_stroke_size.name = "line_size";
      line_stroke_size.value = "1";
      line_stroke_size.step = ".5";
      line_stroke_size.style.width = "50px";

      lineStrokeSizeRow.appendChild(line_stroke_size_label);
      lineStrokeSizeRow.appendChild(line_stroke_size);

      // Append the line stroke size row to the section container
      lineStrokeSection.appendChild(lineStrokeSizeRow);

      // Line Stroke Style
      let lineStrokeStyleRow = document.createElement("div");
      lineStrokeStyleRow.style.display = "flex";
      lineStrokeStyleRow.style.alignItems = "center";
      lineStrokeStyleRow.style.gap = "10px";
      lineStrokeStyleRow.style.marginTop = "5px";
      lineStrokeStyleRow.style.marginBottom = "5px";

      let line_stroke_types_label = document.createElement("span");
      line_stroke_types_label.innerText = "Style:";
      line_stroke_types_label.style.fontWeight = "normal";
      lineStrokeStyleRow.appendChild(line_stroke_types_label);

      let line_stroke_types = [
        { id: "solid", value: "Solid" },
        { id: "dash", value: "Dash" },
        { id: "dot", value: "Dot" },
      ];
      for (let i = 0; i < line_stroke_types.length; i++) {
        let radioContainer = document.createElement("div");
        radioContainer.style.display = "flex";
        radioContainer.style.alignItems = "center";
        radioContainer.style.gap = "5px";

        let radio = document.createElement("input");
        radio.type = "radio";
        radio.id = line_stroke_types[i].id;
        radio.value = line_stroke_types[i].id;
        radio.name = "line_stroke_style";
        radio.style.margin = "0";
        radio.style.verticalAlign = "middle";

        if (i === 0) {
          // If this is the first radio button, we set it to checked
          radio.checked = true;
        }

        let label = document.createElement("label");
        label.setAttribute("for", radio.id);
        label.innerHTML = line_stroke_types[i].value;
        label.style.fontWeight = "normal";
        label.style.margin = "0"; // Remove default margin
        label.style.lineHeight = "1"; // Ensure the line height matches

        radioContainer.appendChild(radio);
        radioContainer.appendChild(label);

        lineStrokeStyleRow.appendChild(radioContainer);
      }

      // Append the line stroke style row to the section container
      lineStrokeSection.appendChild(lineStrokeStyleRow);

      // Append the line stroke section to the input container
      inputContainer.appendChild(lineStrokeSection);

      // Line Stroke Opacity
      let lineStrokeOpacityRow = document.createElement("div");
      lineStrokeOpacityRow.style.display = "flex";
      lineStrokeOpacityRow.style.flexDirection = "column";

      let line_stroke_opacity_label = document.createElement("label");
      line_stroke_opacity_label.setAttribute("for", "line_stroke_opacity");
      line_stroke_opacity_label.innerHTML = "Opacity % [100]";
      line_stroke_opacity_label.style.fontWeight = "normal";

      let line_stroke_opacity = document.createElement("input");
      line_stroke_opacity.type = "range";
      line_stroke_opacity.id = "line_stroke_opacity";
      line_stroke_opacity.min = "0";
      line_stroke_opacity.max = "1";
      line_stroke_opacity.step = ".05";
      line_stroke_opacity.value = "1";
      line_stroke_opacity.name = "line_stroke_opacity";
      line_stroke_opacity.style.width = "100%";

      // Apply modern styling to the range input
      line_stroke_opacity.style.appearance = "none";
      line_stroke_opacity.style.height = "12px";
      line_stroke_opacity.style.borderRadius = "5px";
      line_stroke_opacity.style.outline = "none";

      // Initialize with input color's current value
      let updateLineOpacityInputStyles = () => {
        let color = input_color.value;
        let opacityValue = line_stroke_opacity.value;
        let rgbaColor = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${opacityValue})`;
        line_stroke_opacity.style.backgroundColor = rgbaColor;
        line_stroke_opacity.style.border = `2px solid ${color}`;
      };

      updateLineOpacityInputStyles();

      // Event listener to update the label dynamically
      line_stroke_opacity.addEventListener("input", function () {
        line_stroke_opacity_label.innerHTML = `Opacity % [${Math.round(this.value * 100)}]`;
        updateLineOpacityInputStyles();
      });
      // Add an event listener to update styles when color input changes
      input_color.addEventListener("input", () => {
        updateOpacityInputStyles();
        updateLineOpacityInputStyles();
      });

      lineStrokeOpacityRow.appendChild(line_stroke_opacity_label);
      lineStrokeOpacityRow.appendChild(line_stroke_opacity);

      // Append the line stroke opacity row to the input container
      inputContainer.appendChild(lineStrokeOpacityRow);

      // Adding a horizontal break before Label Position
      let hrElement2 = document.createElement("hr");
      hrElement2.style.margin = "5px 0"; // Adjust margin to reduce vertical space
      hrElement2.style.border = "0"; // Remove default border
      hrElement2.style.borderTop = "1px solid #ddd"; // Add custom border
      inputContainer.appendChild(hrElement2);

      // Section for label position
      let labelPositionSection = document.createElement("div");
      labelPositionSection.style.display = "flex";
      labelPositionSection.style.flexDirection = "column";

      // Label position section label
      let labelPositionSectionLabel = document.createElement("span");
      labelPositionSectionLabel.innerText = "Label Position Settings:";
      labelPositionSectionLabel.style.fontWeight = "bold";
      labelPositionSectionLabel.style.marginBottom = "5px";
      labelPositionSection.appendChild(labelPositionSectionLabel);

      // Container for horizontal and vertical positioning options
      let labelPositionContainer = document.createElement("div");
      labelPositionContainer.style.display = "flex";
      labelPositionContainer.style.marginLeft = "10px";
      labelPositionContainer.style.gap = "80px";

      // Column for horizontal alignment
      let horizontalColumn = document.createElement("div");
      horizontalColumn.style.display = "flex";
      horizontalColumn.style.flexDirection = "column";
      horizontalColumn.style.gap = "5px";

      let horizontalLabel = document.createElement("span");
      horizontalLabel.innerText = "Horizontal:";
      horizontalLabel.style.fontWeight = "normal";
      horizontalColumn.appendChild(horizontalLabel);

      let label_pos_horizontal = [
        { id: "l", value: "Left" },
        { id: "c", value: "Center" },
        { id: "r", value: "Right" },
      ];
      for (let i = 0; i < label_pos_horizontal.length; i++) {
        let radioHorizontalRow = document.createElement("div");
        radioHorizontalRow.style.display = "flex";
        radioHorizontalRow.style.alignItems = "center";
        radioHorizontalRow.style.gap = "5px"; // Smaller space between radio and label

        let radio = document.createElement("input");
        radio.type = "radio";
        radio.id = label_pos_horizontal[i].id;
        radio.value = label_pos_horizontal[i].id;
        radio.name = "label_pos_horizontal";
        radio.style.margin = "0"; // Remove default margin
        radio.style.verticalAlign = "middle"; // Center align radios with text

        let label = document.createElement("label");
        label.setAttribute("for", radio.id);
        label.innerHTML = label_pos_horizontal[i].value;
        label.style.fontWeight = "normal";
        label.style.margin = "0"; // Remove default margin
        label.style.lineHeight = "1"; // Ensure the line height matches

        if (radio.id === "c") {
          // If this is the first radio button, we set it to checked
          radio.checked = true;
        }

        radioHorizontalRow.appendChild(radio);
        radioHorizontalRow.appendChild(label);
        horizontalColumn.appendChild(radioHorizontalRow);
      }

      // Column for vertical alignment
      let verticalColumn = document.createElement("div");
      verticalColumn.style.display = "flex";
      verticalColumn.style.flexDirection = "column";
      verticalColumn.style.gap = "5px";

      let verticalLabel = document.createElement("span");
      verticalLabel.innerText = "Vertical:";
      verticalLabel.style.fontWeight = "normal";
      verticalColumn.appendChild(verticalLabel);

      let label_pos_vertical = [
        { id: "t", value: "Top" },
        { id: "m", value: "Middle" },
        { id: "b", value: "Bottom" },
      ];
      for (let i = 0; i < label_pos_vertical.length; i++) {
        let radioVerticalRow = document.createElement("div");
        radioVerticalRow.style.display = "flex";
        radioVerticalRow.style.alignItems = "center";
        radioVerticalRow.style.gap = "5px";

        let radio = document.createElement("input");
        radio.type = "radio";
        radio.id = label_pos_vertical[i].id;
        radio.value = label_pos_vertical[i].id;
        radio.name = "label_pos_vertical";
        radio.style.margin = "0"; // Remove default margin
        radio.style.verticalAlign = "middle"; // Center align radios with text

        let label = document.createElement("label");
        label.setAttribute("for", radio.id);
        label.innerHTML = label_pos_vertical[i].value;
        label.style.fontWeight = "normal";
        label.style.margin = "0"; // Remove default margin
        label.style.lineHeight = "1"; // Ensure the line height matches

        if (radio.id === "m") {
          // If this is the first radio button, we set it to checked
          radio.checked = true;
        }

        radioVerticalRow.appendChild(radio);
        radioVerticalRow.appendChild(label);
        verticalColumn.appendChild(radioVerticalRow);
      }

      // Append columns to the label position container
      labelPositionContainer.appendChild(horizontalColumn);
      labelPositionContainer.appendChild(verticalColumn);

      // Append the label position container to the label position section
      labelPositionSection.appendChild(labelPositionContainer);

      // Append the label position section to the input container
      inputContainer.appendChild(labelPositionSection);

      // Append the input container to the form
      geoform.appendChild(inputContainer);

      // Adding a horizontal break before the WKT input section
      let hrElement3 = document.createElement("hr");
      hrElement3.style.margin = "10px 0"; // Adjust margin to reduce vertical space
      hrElement3.style.border = "0"; // Remove default border
      hrElement3.style.borderTop = "1px solid #ddd"; // Add custom border
      geoform.appendChild(hrElement3);

      // New label for the Text Area for WKT input section
      let wktSectionLabel = document.createElement("div");
      wktSectionLabel.innerHTML = 'WKT Input: (<a href="https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry" target="_blank">WKT Format</a> )';
      wktSectionLabel.style.fontWeight = "bold";
      wktSectionLabel.style.marginBottom = "5px";
      wktSectionLabel.style.display = "block";
      geoform.appendChild(wktSectionLabel);
      // Text Area for WKT input
      let wktContainer = document.createElement("div");
      wktContainer.style.display = "flex";
      wktContainer.style.flexDirection = "column";
      wktContainer.style.gap = "5px";
      // Input for WKT Name
      let input_WKT_name = document.createElement("input");
      input_WKT_name.type = "text";
      input_WKT_name.id = "input_WKT_name";
      input_WKT_name.name = "input_WKT_name";
      input_WKT_name.placeholder = "Name of WKT";
      input_WKT_name.style.padding = "8px";
      input_WKT_name.style.fontSize = "1rem";
      input_WKT_name.style.border = "2px solid #ddd";
      input_WKT_name.style.borderRadius = "5px";
      input_WKT_name.style.width = "100%";
      input_WKT_name.style.boxSizing = "border-box";
      wktContainer.appendChild(input_WKT_name);

      // Text Area for WKT input
      let input_WKT = document.createElement("textarea");
      input_WKT.id = "input_WKT";
      input_WKT.name = "input_WKT";
      input_WKT.placeholder = "POINT(X Y)  LINESTRING (X Y, X Y,...)  POLYGON(X Y, X Y, X Y,...) etc....";
      input_WKT.style.width = "100%";
      input_WKT.style.height = "10rem";
      input_WKT.style.padding = "8px";
      input_WKT.style.fontSize = "1rem";
      input_WKT.style.border = "2px solid #ddd";
      input_WKT.style.borderRadius = "5px";
      input_WKT.style.boxSizing = "border-box";
      input_WKT.style.resize = "vertical"; // Limit resizing to vertical only
      wktContainer.appendChild(input_WKT);

      // Container for the buttons
      let buttonContainer = document.createElement("div");
      buttonContainer.style.display = "flex";
      buttonContainer.style.gap = "45px";

      let submit_WKT_btn = createButton("Import WKT", "#8BC34A", "#689F38", "input");
      submit_WKT_btn.id = "submit_WKT_btn";
      submit_WKT_btn.title = "Import WKT Geometry to WME Layer";
      submit_WKT_btn.addEventListener("click", draw_WKT);
      buttonContainer.appendChild(submit_WKT_btn);

      let clear_WKT_btn = createButton("Clear WKT", "#E57373", "#D32F2F", "input");
      clear_WKT_btn.id = "clear_WKT_btn";
      clear_WKT_btn.title = "Clear WKT Geometry Input and Name";
      clear_WKT_btn.addEventListener("click", clear_WKT_input);
      buttonContainer.appendChild(clear_WKT_btn);

      wktContainer.appendChild(buttonContainer);
      geoform.appendChild(wktContainer); // Append the container to the form

      // Add Toggle Button for Debug
      let debugToggleContainer = document.createElement("div");
      debugToggleContainer.style.display = "flex";
      debugToggleContainer.style.alignItems = "center";
      debugToggleContainer.style.marginTop = "15px";

      let debugToggleLabel = document.createElement("label");
      debugToggleLabel.style.marginRight = "10px";

      const updateLabel = () => {
        debugToggleLabel.innerText = `Debug mode ${debug ? "ON" : "OFF"}`;
      };

      let debugSwitchWrapper = document.createElement("label");
      debugSwitchWrapper.style.position = "relative";
      debugSwitchWrapper.style.display = "inline-block";
      debugSwitchWrapper.style.width = "40px";
      debugSwitchWrapper.style.height = "20px";
      debugSwitchWrapper.style.border = "1px solid #ccc";
      debugSwitchWrapper.style.borderRadius = "20px";

      let debugToggleSwitch = document.createElement("input");
      debugToggleSwitch.type = "checkbox";
      debugToggleSwitch.style.opacity = "0";
      debugToggleSwitch.style.width = "0";
      debugToggleSwitch.style.height = "0";

      let switchSlider = document.createElement("span");
      switchSlider.style.position = "absolute";
      switchSlider.style.cursor = "pointer";
      switchSlider.style.top = "0";
      switchSlider.style.left = "0";
      switchSlider.style.right = "0";
      switchSlider.style.bottom = "0";
      switchSlider.style.backgroundColor = "#ccc";
      switchSlider.style.transition = ".4s";
      switchSlider.style.borderRadius = "20px";

      let innerSpan = document.createElement("span");
      innerSpan.style.position = "absolute";
      innerSpan.style.height = "14px";
      innerSpan.style.width = "14px";
      innerSpan.style.left = "3px";
      innerSpan.style.bottom = "3px";
      innerSpan.style.backgroundColor = "white";
      innerSpan.style.transition = ".4s";
      innerSpan.style.borderRadius = "50%";

      switchSlider.appendChild(innerSpan);

      const updateSwitchState = () => {
        switchSlider.style.backgroundColor = debug ? "#8BC34A" : "#ccc";
        innerSpan.style.transform = debug ? "translateX(20px)" : "translateX(0)";
      };

      debugToggleSwitch.checked = debug;
      updateLabel();
      updateSwitchState();

      debugToggleSwitch.addEventListener("change", () => {
        debug = debugToggleSwitch.checked;
        updateLabel();
        updateSwitchState();
        console.log(`${scriptName}: Debug mode is now ${debug ? "enabled" : "disabled"}`);
      });

      debugSwitchWrapper.appendChild(debugToggleSwitch);
      debugSwitchWrapper.appendChild(switchSlider);
      debugToggleContainer.appendChild(debugToggleLabel);
      debugToggleContainer.appendChild(debugSwitchWrapper);
      geoform.appendChild(debugToggleContainer);

      console.log(`${scriptName}: User Interface Loaded!`);
      // Log the OpenLayers version
      if (OpenLayers.VERSION_NUMBER) {
        if (debug) console.log(`${scriptName}: OpenLayers Version: ${OpenLayers.VERSION_NUMBER}`);
      }
      loadLayers();
    });
  }

  /****************************************************************************
   * draw_WKT
   *
   * Description:
   * Parses user-supplied Well-Known Text (WKT) to create a geometric layer on the map using the wicket.js library for
   * reliable parsing. This function configures the layer with user-defined styling options and ensures the layer is
   * stored and displayed appropriately.
   *
   * Parameters:
   * - No explicit parameters are passed; all input is taken from DOM elements configured by the user.
   *
   * Behavior:
   * - Retrieves styling options and WKT input from predefined HTML elements.
   * - Checks for duplicate layer names to prevent adding layers with the same name to the map.
   * - Validates the presence of WKT input and handles errors related to parsing and conversion to GeoJSON format.
   * - Constructs a `layerStoreObj` containing the parsed GeoJSON data and its styling details.
   * - Uses `parseFile` to add the parsed and styled layer to the map.
   * - Compresses and stores the layer information in `localStorage` for persistence.
   * - Provides users with real-time feedback via console logs and alerts when debug mode is enabled or when errors arise.
   *
   * Notes:
   * - Utilizes global variables and functions such as `formats`, `storedLayers`, and `parseFile`.
   * - Relies on DOM elements and user inputs that need to be correctly set up in the environment for this function to work.
   *****************************************************************************/

  function draw_WKT() {
    if (debug) console.log(`${scriptName}: draw_WKT(): Import WKT called`);

    // Retrieve style and layer options
    let color = document.getElementById("color").value;
    let fillOpacity = document.getElementById("fill_opacity").value;
    let fontsize = document.getElementById("font_size").value;
    let lineopacity = document.getElementById("line_stroke_opacity").value;
    let linesize = document.getElementById("line_size").value;
    let linestyle = document.querySelector('input[name="line_stroke_style"]:checked').value;
    let layerName = document.getElementById("input_WKT_name").value;
    let labelpos = document.querySelector('input[name="label_pos_horizontal"]:checked').value + document.querySelector('input[name="label_pos_vertical"]:checked').value;

    // Check for empty layer name
    if (layerName.trim() === "") {
      if (debug) console.error(`${scriptName}: WKT Input layer name cannot be empty.`);
      WazeWrap.Alerts.error(scriptName, "WKT Input layer name cannot be empty.");
      return;
    }
    // Check for duplicate layer name
    let layers = W.map.getLayersBy("layerGroup", "wme_geometry");
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].name === "Geometry: " + layerName) {
        if (debug) console.error(`${scriptName}: Current WKT layer name already used`);
        WazeWrap.Alerts.error(scriptName, "Current layer name already used!");
        return;
      }
    }
    // Retrieve and validate WKT input
    let wktInput = document.getElementById("input_WKT").value.trim();
    if (wktInput === "") {
      if (debug) console.error(`${scriptName}: WKT input is empty.`);
      WazeWrap.Alerts.error(scriptName, "WKT input is empty.");
      return;
    }

    let geojsonData;
    try {
      // Initialize GeoWKTer and parse WKT
      let wktObj = new GeoWKTer();
      if (debug) console.info(`${scriptName}: WKT input:`, wktInput);

      // Parse and convert WKT to GeoJSON
      let parsedData = wktObj.read(wktInput, layerName);
      if (debug) console.info(`${scriptName}: WKT input successfully read:`, parsedData);

      geojsonData = wktObj.toGeoJSON(parsedData);
      if (debug) console.log(`${scriptName}: draw_WKT(): WKT input successfully converted to GeoJSON`, geojsonData);
    } catch (error) {
      if (debug) console.error(`${scriptName}: Error processing WKT input.`, error);
      WazeWrap.Alerts.error(scriptName, `Error processing WKT. Please check your input format.\n` + error);
      return;
    }
    // Construct and store the layer object
    try {
      let geojson_layer = new layerStoreObj(geojsonData, color, "GEOJSON", layerName, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "Name", "WKT");
      storedLayers.push(geojson_layer);
      parseFile(geojson_layer);

      // Compressed storage in localStorage
      localStorage.WMEGeoLayers = LZString.compress(JSON.stringify(storedLayers));
      console.log(`${scriptName}: draw_WKT(): Stored WKT Input - ${layerName} : ${localStorage.WMEGeoLayers.length / 1000} kB in localStorage`);
    } catch (error) {
      if (debug) console.error(`${scriptName}: Error storing or adding WKT layer.`, error);
      WazeWrap.Alerts.error(scriptName, "Error storing or adding the WKT layer.");
    }
  }

  /*******************************************************************************
   * drawStateBoundary
   *
   * Description:
   * This function draws the boundary of the currently selected state on the map, using specific styling options
   * provided by the user. It checks for the existence of the state boundary data, ensures that it’s not already
   * loaded, and then processes it into a geometrically styled layer.
   *
   * Parameters:
   * - No direct parameters; relies on DOM elements and global objects for inputs and operations.
   *
   * Behavior:
   * - Extracts styling options from DOM input elements for color, opacity, font size, line style, and label position.
   * - Checks if the state and its geometry data are available in the global WME (Waze Map Editor) model.
   * - Verifies whether the state’s geometric boundary is already loaded on the map to prevent duplication.
   * - Constructs a `layerStoreObj` with the state’s geometry data serialized to a GeoJSON format along with styling.
   * - Calls `parseFile` to create and add the state boundary as a new map layer.
   * - Updates localStorage with the compressed state geometry data, maintaining persistence across sessions.
   *
   * Notes:
   * - Utilizes global variables such as `W.map`, `W.model`, and `storedLayers`, which must be pre-defined.
   * - Provides user feedback through console logs and UI alerts, especially when the state data is unavailable or already loaded.
   * - Debug logging is conditional based on the `debug` flag to assist in development and troubleshooting.
   *****************************************************************************/
  function drawStateBoundary() {
    if (debug) console.info(`${scriptName}: drawStateBoundary() called`);
    // add formating Options and locaal storage for WME refresh availability to Draw State Boundary functionality
    let color = document.getElementById("color").value;
    let fillOpacity = document.getElementById("fill_opacity").value;
    let fontsize = document.getElementById("font_size").value;
    let lineopacity = document.getElementById("line_stroke_opacity").value;
    let linesize = document.getElementById("line_size").value;
    let linestyle = document.querySelector('input[name="line_stroke_style"]:checked').value;
    let labelpos = document.querySelector('input[name="label_pos_horizontal"]:checked').value + document.querySelector('input[name="label_pos_vertical"]:checked').value;

    if (!W.model.topState || !W.model.topState.attributes || !W.model.topState.attributes.geometry) {
      if (debug) console.info(`${scriptName}: no state or geometry available, sorry!`);
      WazeWrap.Alerts.info(scriptName, "No State or Geometry Available, Sorry!");
      return;
    }
    let layerName = `(${W.model.topState.attributes.name})`.replace(/[^A-Za-z]/g, "");
    if (debug) console.info(`${scriptName}: State or geometry is:`, layerName);

    let layers = W.map.getLayersBy("layerGroup", "wme_geometry");
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].name == "Geometry: " + layerName) {
        if (debug) console.info(`${scriptName}: current state already loaded`);
        WazeWrap.Alerts.info(scriptName, "Current State Boundary already Loaded!");
        return;
      }
    }

    let state_geo = W.model.topState.attributes.geometry;
    // Convert to GeoJSON
    let state_geojson;
    try {
      state_geojson = {
        type: "Feature",
        geometry: state_geo,
        properties: {
          Name: layerName,
        },
      };
    } catch (error) {
      if (debug) console.error(`${scriptName}:  Error converting topState.attributes.geometry to GeoJSON`, error);
      WazeWrap.Alerts.error(scriptName, "Error converting topState.attributes.geometry to GeoJSON");
      return;
    }

    let state_obj = new layerStoreObj(state_geojson, color, "GEOJSON", layerName, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "Name", "GEOJSON");
    storedLayers.push(state_obj);

    if (debug) console.info(`${scriptName}: State _obj:`, state_obj);
    parseFile(state_obj);
    localStorage.WMEGeoLayers = LZString.compress(JSON.stringify(storedLayers));
    console.info(`${scriptName}: Stored the State of ${layerName} : ${localStorage.WMEGeoLayers.length / 1000} kB in localStorage`);
  }

  // Clears the current contents of the textarea.
  function clear_WKT_input() {
    document.getElementById("input_WKT").value = "";
    document.getElementById("input_WKT_name").value = "";
  }

  /*************************************************************************
   * addGeometryLayer
   *
   * Description:
   * Facilitates the addition of a new geometry layer to the map by reading a user-selected file, parsing its contents,
   * and configuring the layer with specified styling options. The function also updates UI elements and handles storage
   * of the layer information.
   *
   * Process:
   * - Captures a file from a user's file input and determines its extension and name.
   * - Collects styling and configuration options from the user interface through DOM elements.
   * - Validates user-selected file format against supported formats, handling any unsupported formats with an error message.
   * - Leverages a `FileReader` to asynchronously read the file's contents and creates a `fileObj`.
   * - Calls `parseFile` to interpret `fileObj`, creating and configuring the geometry layers on the map.
   * - Updates persistent storage with compressed data to save the state of added geometrical layers.
   *
   * Notes:
   * - Operates within a larger system context, relying on global variables such as `formats` for file format validation.
   *************************************************************************/

  function addGeometryLayer() {
    if (debug) console.log(`${scriptName}: addGeometryLayer(): called`);

    const fileList = document.getElementById("GeometryFile");
    const file = fileList.files[0];
    fileList.value = "";

    const fileName = file.name;
    const lastDotIndex = fileName.lastIndexOf(".");

    const fileext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex + 1).toUpperCase() : "";
    const filename = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;

    // Collect configuration options from UI
    const color = document.getElementById("color").value;
    const fillOpacity = document.getElementById("fill_opacity").value;
    const fontsize = document.getElementById("font_size").value;
    const lineopacity = document.getElementById("line_stroke_opacity").value;
    const linesize = document.getElementById("line_size").value;
    const linestyle = document.querySelector('input[name="line_stroke_style"]:checked').value;
    const labelpos = document.querySelector('input[name="label_pos_horizontal"]:checked').value + document.querySelector('input[name="label_pos_vertical"]:checked').value;

    const reader = new FileReader();

    reader.onload = function (e) {
      requestAnimationFrame(() => {
        try {
          let fileObj;
          switch (fileext) {
            case "ZIP":
              shp(e.target.result)
                .then((geojson) => {
                  if (debug) console.log(`${scriptName}: ZIP file processed, resulting GeoJSON`, geojson);
                  fileObj = new layerStoreObj(geojson, color, "GEOJSON", filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", "SHP");
                  parseFile(fileObj);
                })
                .catch(handleError("ZIP shapefile"));
              break;

            case "WKT":
              if (debug) console.log(`${scriptName}: WKT file detected, converting to GeoJSON...`);
              try {
                const geoWKTer = new GeoWKTer();
                const wktData = geoWKTer.read(e.target.result, filename);
                const WKTtoGeoJSON = geoWKTer.toGeoJSON(wktData);
                fileObj = new layerStoreObj(WKTtoGeoJSON, color, "GEOJSON", filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", fileext);
                parseFile(fileObj);
              } catch (error) {
                handleError("WKT conversion")(error);
              }
              break;

            case "GPX":
              try {
                const geoGPXer = new GeoGPXer();
                const gpxDoc = geoGPXer.read(e.target.result);
                const GPXtoGeoJSON = geoGPXer.toGeoJSON(gpxDoc);
                fileObj = new layerStoreObj(GPXtoGeoJSON, color, "GEOJSON", filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", fileext);
                parseFile(fileObj);
              } catch (error) {
                handleError("GPX conversion")(error);
              }
              break;

            case "GEOJSON":
            case "KML":
            case "GML":
            case "OSM":
              try {
                fileObj = new layerStoreObj(e.target.result, color, fileext, filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", fileext);
                parseFile(fileObj);
              } catch (error) {
                handleError(`${fileext} parsing`)(error);
              }
              break;

            default:
              handleError("unsupported file type")(new Error("Unsupported file type"));
              break;
          }
        } catch (error) {
          handleError("file")(error);
        }
      });
    };

    fileext === "ZIP" ? reader.readAsArrayBuffer(file) : reader.readAsText(file);

    function handleError(context) {
      return (error) => {
        console.error(`${scriptName}: Error processing ${context}:`, error);
        WazeWrap.Alerts.error(scriptName, `Error processing ${context} :(`);
      };
    }
  }

  /*************************************************************************************
   * parseFile
   *
   * Description:
   * Processes a file object containing geographic data, formats, and styles it, adding the result as a vector layer
   * to the map. The function updates the User Interface (UI) to reflect the file loading status and handles
   * labeling configurations based on attribute selection within the file's data.
   *
   * Parameters:
   * @param {Object} fileObj - An object containing data and metadata for the file to be parsed.
   *   - {string} fileObj.filename - Name of the file processed.
   *   - {string} fileObj.fileext - File extension, used to determine the appropriate parser.
   *   - {string} fileObj.fileContent - Raw content of the file.
   *   - {string} fileObj.color - Specifies the color styling for the layer.
   *   - {number} fileObj.lineopacity, fileObj.linesize, fileObj.linestyle - Line styling settings.
   *   - {number} fileObj.fillOpacity - Opacity for filled areas.
   *   - {number} fileObj.fontsize - Font size for labeling purposes.
   *   - {string} fileObj.labelpos - Anchor position for any labels.
   *
   * Behavior:
   * - Outputs debug information if debugging is activated.
   * - Establishes style configurations for the vector layer using properties defined in `fileObj`.
   * - Determines the correct parser to use based on the file's extension, setting projections appropriately.
   * - Attempts to parse the file content into geographic features, logging any errors encountered.
   * - If the file's attribute contains a previously set label attribute, it proceeds to create a styled layer with labels.
   * - For files without a pre-defined label attribute, it offers an interface for user selection from the attributes.
   * - Constructs the vector layer, styles, and integrates it onto the map, managing labels based on user input or default settings.
   * - Updates the UI list items to reflect the status and details of loading the file.
   *
   * Notes:
   * - Heavily relies on global context elements like `W.map` for projections and map management, and `geolist` for UI maintenance.
   * - Provides detailed debug logs when the debug flag is active, aiding in troubleshooting and validating process steps.
   ***************************************************************************************/
  function parseFile(fileObj) {
    if (debug) console.log(`${scriptName}: parseFile(): called`, fileObj);
    const fileext = fileObj.fileext.toUpperCase();
    const orgFileext = fileObj.orgFileext.toUpperCase();
    const fileContent = fileObj.fileContent;
    const filename = fileObj.filename;
    const parser = formats[fileext];

    let EPSG_4326 = new OpenLayers.Projection("EPSG:4326"); // WGS 84
    let EPSG_4269 = new OpenLayers.Projection("EPSG:4269"); // NAD 83
    let EPSG_3857 = new OpenLayers.Projection("EPSG:3857"); // Web Mercator
    let EPSG_3035 = new OpenLayers.Projection("EPSG:3035"); // ETRS89 / LAEA Europe
    let EPSG_4267 = new OpenLayers.Projection("EPSG:4267"); // NAD 27
    let EPSG_28356 = new OpenLayers.Projection("EPSG:28356"); // GDA94 / MGA zone 56

    if (!parser) {
      console.error(`${scriptName}: parseFile(): No parser found for format: ${fileext}`);
      return;
    }

    // Assign internalProjection
    parser.internalProjection = W.map.getProjectionObject();

    // Default external projection
    parser.externalProjection = EPSG_4326;

    // Modify the external projection based on detected EPSG codes
    if (/"EPSG:3857"/.test(fileContent) || /:EPSG::3857"/.test(fileContent)) {
      parser.externalProjection = EPSG_3857;
    } else if (/"EPSG:4269"/.test(fileContent) || /:EPSG::4269"/.test(fileContent)) {
      parser.externalProjection = EPSG_4269;
    } else if (/"EPSG:3035"/.test(fileContent) || /:EPSG::3035"/.test(fileContent)) {
      parser.externalProjection = EPSG_3035;
    } else if (/"EPSG:4267"/.test(fileContent) || /:EPSG::4267"/.test(fileContent)) {
      parser.externalProjection = EPSG_4267;
    } else if (/"EPSG:28356"/.test(fileContent) || /:EPSG::28356"/.test(fileContent)) {
      parser.externalProjection = EPSG_28356;
    }

    if (debug) console.log(`${scriptName}: parseFile(): External projection is: ${parser.externalProjection}`);

    let features;
    try {
      features = parser.read(fileContent);
      if (debug) console.log(`${scriptName}: parseFile(): Found ${features.length} features for ${filename}.${orgFileext}.`);

      if (features.length === 0) {
        WazeWrap.Alerts.error(scriptName, `No features found in file ${filename}.${orgFileext}`);
        console.warn(`${scriptName}: parseFile(): No features found in file ${filename}.${orgFileext}.`);
        return; // Early return to stop further execution when no features are found
      }
    } catch (error) {
      console.error(`${scriptName}: parseFile(): Error parsing file content for ${filename}.${orgFileext}:`, error);
      WazeWrap.Alerts.error(scriptName, `Error parsing file content for ${filename}.${orgFileext}: ${error}`);
      return;
    }

    if (fileObj.labelattribute) {
      createLayerWithLabel(fileObj, features, parser.externalProjection); // Use the stored label attribute if it already exists
    } else {
      if (debug) console.log(`${scriptName}: parseFile(): features.slice:`, features.slice(0, 9));
      // Await user interaction to get the label attribute when it's not already set
      presentFeaturesAttributes(features.slice(0, 50), features.length)
        .then((selectedAttribute) => {
          if (selectedAttribute) {
            //&& typeof features[0].attributes[selectedAttribute] === "string"
            fileObj.labelattribute = selectedAttribute;
            console.log(`${scriptName}: parseFile(): labelattribute selected: ${fileObj.labelattribute}`);
            createLayerWithLabel(fileObj, features, parser.externalProjection);
          }
        })
        .catch((cancelReason) => {
          console.warn(`${scriptName}: parseFile(): User cancelled attribute selection: ${cancelReason}`);
        });
    }

    if (debug) console.log(`${scriptName}: parseFile() finished.`);
  }

  /******************************************************************************************
   * createLayerWithLabel
   *
   * Description:
   * Configures and adds a new vector layer to the map, applying styling and dynamic labeling
   * based on attributes from the geographic features. This function manages the label style context,
   * constructs the layer, updates the UI with toggler controls, and stores the layer configuration
   * in local storage to preserve its state across sessions.
   *
   * Parameters:
   * @param {Object} fileObj - Object containing metadata and styling options for the layer.
   *   - {string} fileObj.filename - The name of the file, used for layer identification.
   *   - {string} fileObj.color - The color used for styling the layer.
   *   - {number} fileObj.lineopacity - Opacity for line styling.
   *   - {number} fileObj.linesize - Width of lines in the layer.
   *   - {string} fileObj.linestyle - Dash style for lines.
   *   - {number} fileObj.fillOpacity - Opacity for filling geometries.
   *   - {number} fileObj.fontsize - Font size for labels and points.
   *   - {string} fileObj.labelattribute - Template string for labeling features; may use `${attribute}` syntax.
   *   - {string} fileObj.labelpos - Position for label text alignment.
   * @param {Array} features - Array of geographic features to be added to the layer.
   * @param {Object} externalProjection - Projection object for transforming feature coordinates as necessary.
   *
   * Behavior:
   * - Constructs a label context with functions to format and position labels based on feature attributes.
   * - Defines layer styling using attributes from `fileObj` and assigns a context for dynamic label computation.
   * - Creates a new vector layer, sets its unique ID, and assigns a z-index for rendering order.
   * - Uses `OpenLayers.StyleMap` to apply the defined style and attaches provided features to the layer.
   * - Prevents duplicate storage by checking existing layers, updating local storage only for new layers.
   * - Registers the layer with a group toggler, providing UI controls for visibility management.
   * - Integrates the layer into the main map and manages additional elements like toggling and list updates.
   ******************************************************************************************/

  function createLayerWithLabel(fileObj, features, externalProjection) {
    if (debug) console.log(`${scriptName}: createLayerWithLabel(): Called`);

    toggleLoadingMessage(true);

    const delayDuration = 300;
    setTimeout(() => {
      try {
        let labelContext = {
          formatLabel: function (feature) {
            let labelTemplate = fileObj.labelattribute;

            if (!labelTemplate || labelTemplate.trim() === "") {
              return "";
            }
            // Handel new lines  /n
            labelTemplate = labelTemplate.replace(/\\n/g, "\n");
            // Handle both direct names and templated inputs with placeholders
            try {
              // Check if `labelTemplate` is a direct attribute name without placeholder format
              if (!labelTemplate.includes("${")) {
                if (feature.attributes.hasOwnProperty(labelTemplate)) {
                  return feature.attributes[labelTemplate] || "";
                }
                return ""; // Return empty if the attribute is directly named and not found
              }

              // Handle templated inputs like '${name}'
              labelTemplate = labelTemplate
                .replace(/\${(.*?)}/g, (match, attributeName) => {
                  attributeName = attributeName.trim();

                  if (feature.attributes.hasOwnProperty(attributeName)) {
                    return feature.attributes[attributeName] || "";
                  }

                  return ""; // Replace with empty if attribute not found
                })
                .trim();
            } catch (error) {
              console.error(`${scriptName}: Error processing label expression:`, error);
              return "";
            }

            return labelTemplate;
          },
          getOffset: function () {
            return -(W.map.getZoom() + 5);
          },
          getSmooth: function () {
            return "";
          },
          getReadable: function () {
            return "1";
          },
        };

        if (debug) console.log(`${scriptName}: labelContext() = : ${labelContext}`);

        const layerStyle = {
          stroke: true,
          strokeColor: fileObj.color,
          strokeOpacity: fileObj.lineopacity,
          strokeWidth: fileObj.linesize,
          strokeDashstyle: fileObj.linestyle,
          fillColor: fileObj.color,
          fillOpacity: fileObj.fillOpacity,
          pointRadius: fileObj.fontsize,
          fontColor: fileObj.color,
          fontSize: fileObj.fontsize,
          labelOutlineColor: "black",
          labelOutlineWidth: fileObj.fontsize / 4,
          labelAlign: fileObj.labelpos,
          pathLabel: "${formatLabel}",
          label: "${formatLabel}",
          labelSelect: false,
          pathLabelYOffset: "${getOffset}",
          pathLabelCurve: "${getSmooth}",
          pathLabelReadable: "${getReadable}",
        };

        let defaultStyle = new OpenLayers.Style(layerStyle, { context: labelContext });
        let layerid = `wme_geometry_${layerindex}`;

        let WME_Geometry = new OpenLayers.Layer.Vector(`Geometry: ${fileObj.filename}`, {
          rendererOptions: { zIndexing: true },
          uniqueName: layerid,
          layerGroup: "wme_geometry",
        });

        WME_Geometry.setZIndex(-9999);
        I18n.translations[I18n.locale].layers.name[layerid] = `WME Geometries: ${fileObj.filename}`;
        WME_Geometry.styleMap = new OpenLayers.StyleMap(defaultStyle);
        WME_Geometry.addFeatures(features);

        if (debug) console.log(`${scriptName}: createLayerWithLabel(): Using OpenLayers version: ${OpenLayers.VERSION_NUMBER}`);
        if (debug) console.log(`${scriptName}: createLayerWithLabel(): New OL Geometry Object:`, WME_Geometry);

        const existingLayer = storedLayers.find((layer) => layer.filename === fileObj.filename);

        if (!existingLayer) {
          storedLayers.push(fileObj);
          localStorage.WMEGeoLayers = LZString.compress(JSON.stringify(storedLayers));
          console.info(`${scriptName}: createLayerWithLabel(): Stored file - ${fileObj.filename} : ${localStorage.WMEGeoLayers.length / 1000} kB in localStorage`);
        } else {
          console.log(`${scriptName}: createLayerWithLabel(): Skipping duplicate storage for file: ${fileObj.filename}`);
        }

        if (!groupToggler) {
          groupToggler = addGroupToggler(false, "layer-switcher-group_wme_geometries", "WME Geometries");
        }

        addToGeoList(fileObj.filename, fileObj.color, fileObj.orgFileext, fileObj.labelattribute, externalProjection);
        addLayerToggler(groupToggler, fileObj.filename, WME_Geometry);
        W.map.addLayer(WME_Geometry);
        if (debug) console.log(`${scriptName}: createLayerWithLabel(): New Layer ${fileObj.filename} Added`);
      } finally {
        toggleLoadingMessage(false);
      }
    }, delayDuration);
  }

  function toggleLoadingMessage(show) {
    const existingMessage = document.getElementById("WMEGeoLoadingMessage");

    if (show) {
      if (!existingMessage) {
        const loadingMessage = document.createElement("div");
        loadingMessage.id = "WMEGeoLoadingMessage";
        loadingMessage.style = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          padding: 16px 32px;
          background: rgba(0, 0, 0, 0.7);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          font-family: 'Arial', sans-serif;
          font-size: 1.1rem;
          text-align: center;
          z-index: 2000;
          color: #ffffff;
          border: 2px solid #ff5733;
        `;
        loadingMessage.textContent = "New Geometries Loading, please wait...";
        document.body.appendChild(loadingMessage);
      }
    } else {
      if (existingMessage) {
        existingMessage.remove();
      }
    }
  }

  /**********************************************************************************************************
   * presentFeaturesAttributes
   *
   * Description:
   * Displays a user interface to facilitate the selection of an attribute from a set of geographic features.
   * If there is only one attribute, it automatically resolves with that attribute. Otherwise, it presents a modal
   * dialog with a dropdown list for the user to select the label attribute.
   *
   * Parameters:
   * @param {Array} features - An array of feature objects, each containing a set of attributes to choose from.
   *
   * Returns:
   * @returns {Promise} - A promise that resolves with the chosen attribute or rejects if the user cancels.
   *
   * Behavior:
   * - Immediately resolves if there is only one attribute across all features.
   * - Constructs a modal dialog centrally positioned on the screen to display feature properties.
   * - Iterates over the provided features, listing the attributes for each feature in a scrollable container.
   * - Utilizes a dropdown (`select` element) populated with the attributes for user selection.
   * - Includes "Import" and "Cancel" buttons to either resolve the promise with the selected attribute
   *   or reject the promise, respectively.
   * - Ensures modal visibility with a semi-transparent overlay backdrop.
   *****************************************************************************************************/
  function presentFeaturesAttributes(features, nbFeatures) {
    return new Promise((resolve, reject) => {
      const allAttributes = features.map((feature) => Object.keys(feature.attributes));
      const attributes = Array.from(new Set(allAttributes.flat()));

      let attributeInput = document.createElement("div");
      attributeInput.style.position = "fixed";
      attributeInput.style.left = "50%";
      attributeInput.style.top = "50%";
      attributeInput.style.transform = "translate(-50%, -50%)";
      attributeInput.style.zIndex = "1001";
      attributeInput.style.width = "80%";
      attributeInput.style.maxWidth = "600px";
      attributeInput.style.padding = "10px";
      attributeInput.style.background = "#fff";
      attributeInput.style.border = "3px solid #ccc";
      attributeInput.style.borderRadius = "5%";
      attributeInput.style.display = "flex";
      attributeInput.style.flexDirection = "column";

      let title = document.createElement("label");
      title.style.marginBottom = "5px";
      title.style.color = "#333";
      title.style.alignSelf = "center";
      title.style.fontSize = "1.2em";
      title.innerHTML = `Feature Attributes<br>Total Features: ${nbFeatures}`;
      attributeInput.appendChild(title);

      let message = document.createElement("p");
      message.style.marginTop = "10px";
      message.style.color = "#777";
      message.style.textAlign = "center";

      let selectBox, customLabelInput;

      if (attributes.length === 0) {
        message.textContent = "No attributes found to use as labels for the features.";
        attributeInput.appendChild(message);
      } else {
        let propsContainer = document.createElement("div");
        propsContainer.style.overflowY = "auto";
        propsContainer.style.maxHeight = "300px";
        propsContainer.style.padding = "5px";
        propsContainer.style.backgroundColor = "#f0f0f0"; // Light gray color
        propsContainer.style.border = "1px solid black";
        propsContainer.style.borderRadius = "10px";
        attributeInput.appendChild(propsContainer);

        features.forEach((feature, index) => {
          let featureHeader = document.createElement("label");
          featureHeader.textContent = `Feature ${index + 1}`;
          featureHeader.style.color = "#333";
          featureHeader.style.fontSize = "1.1em";
          propsContainer.appendChild(featureHeader);

          let propsList = document.createElement("ul");
          Object.keys(feature.attributes).forEach((key) => {
            let propItem = document.createElement("li");
            propItem.innerHTML = `<span style="color: blue;">${key}</span>: ${feature.attributes[key]}`;
            propItem.style.listStyleType = "none";
            propItem.style.padding = "2px";
            propItem.style.fontSize = "0.9em";
            propsList.appendChild(propItem);
          });
          propsContainer.appendChild(propsList);
        });

        let inputLabel = document.createElement("label");
        inputLabel.textContent = "Select Attribute to use for Label:";
        inputLabel.style.display = "block";
        inputLabel.style.marginTop = "15px";
        attributeInput.appendChild(inputLabel);

        selectBox = document.createElement("select");
        selectBox.style.width = "90%";
        selectBox.style.padding = "8px";
        selectBox.style.marginTop = "5px";
        selectBox.style.marginLeft = "5%";
        selectBox.style.marginRight = "5%";
        selectBox.style.borderRadius = "5px";

        attributes.forEach((attribute) => {
          let option = document.createElement("option");
          option.value = attribute;
          option.textContent = attribute;
          selectBox.appendChild(option);
        });

        // Add "No Labels" option
        let noLabelsOption = document.createElement("option");
        noLabelsOption.value = " ";
        noLabelsOption.textContent = "- No Labels -";
        selectBox.appendChild(noLabelsOption);

        // Add "Custom Label" option
        let customLabelOption = document.createElement("option");
        customLabelOption.value = "custom";
        customLabelOption.textContent = "Custom Label";
        selectBox.appendChild(customLabelOption);

        attributeInput.appendChild(selectBox);

        // Create a hidden textarea for custom labels
        customLabelInput = document.createElement("textarea");
        customLabelInput.placeholder = `Enter your custom label using \${attributeName} for dynamic values.
        Feature 1
          BridgeNumber: 01995
          FacilityCarried: U.S. ROUTE 6
          FeatureCrossed: BIG RIVER
        
        Example: (explicit new lines formatting)
        #:\${BridgeNumber}\\n\${FacilityCarried} over\\n\${FeatureCrossed}
        
        Example: (multi-line formatting)
        #:\${BridgeNumber}
        \${FacilityCarried} over
        \${FeatureCrossed}

        Expected Output: 
          #:01995
          U.S. ROUTE 6 over
          BIG RIVER`;
        customLabelInput.style.width = "90%";
        customLabelInput.style.height = "300px";
        customLabelInput.style.maxHeight = "300px";
        customLabelInput.style.padding = "8px";
        customLabelInput.style.fontSize = "1rem";
        customLabelInput.style.border = "2px solid #ddd";
        customLabelInput.style.borderRadius = "5px";
        customLabelInput.style.boxSizing = "border-box";
        customLabelInput.style.resize = "vertical"; // Limit resizing to vertical only
        customLabelInput.style.display = "none"; // Hide it initially
        customLabelInput.style.marginTop = "5px";
        customLabelInput.style.marginLeft = "5%";
        customLabelInput.style.marginRight = "5%";
        customLabelInput.style.borderRadius = "5px";
        attributeInput.appendChild(customLabelInput);

        // Show custom label input if "Custom Label" is selected
        selectBox.addEventListener("change", () => {
          if (selectBox.value === "custom") {
            customLabelInput.style.display = "block";
          } else {
            customLabelInput.style.display = "none";
          }
        });
      }

      let buttonsContainer = document.createElement("div");
      buttonsContainer.style.marginTop = "10px";
      buttonsContainer.style.display = "flex";
      buttonsContainer.style.justifyContent = "flex-end";
      buttonsContainer.style.width = "90%";
      buttonsContainer.style.marginLeft = "5%";
      buttonsContainer.style.marginRight = "5%";

      let importButton = createButton("Import", "#8BC34A", "#689F38", "button");
      importButton.onclick = () => {
        // Check if "Custom Label" is selected and the input for it is empty
        if (selectBox.value === "custom" && customLabelInput.value.trim() === "") {
          // Display error message using WazeWrap
          WazeWrap.Alerts.error(scriptName, "Please enter a custom label expression when selecting 'Custom Label'.");
          return; // Exit the function to prevent resolving
        }

        document.body.removeChild(overlay);

        // Resolve with custom label if "Custom Label" is chosen and has input, else resolve with selected value
        if (selectBox.value === "custom" && customLabelInput.value.trim() !== "") {
          resolve(customLabelInput.value.trim());
        } else {
          resolve(selectBox && selectBox.options.length > 0 ? selectBox.value : " ");
        }
      };

      let cancelButton = createButton("Cancel", "#E57373", "#D32F2F", "button");
      cancelButton.onclick = () => {
        document.body.removeChild(overlay);
        reject("Operation cancelled by the user");
      };

      buttonsContainer.appendChild(importButton);
      buttonsContainer.appendChild(cancelButton);
      attributeInput.appendChild(buttonsContainer);

      let overlay = document.createElement("div");
      overlay.id = "presentFeaturesAttributesOverlay";
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.background = "rgba(0,0,0,0.5)";
      overlay.style.zIndex = "1000";
      overlay.appendChild(attributeInput);

      document.body.appendChild(overlay);
    });
  }

  /*************************************************************************************
   * addToGeoList
   *
   * Description:
   * Adds a new list item (representing a geographic file) to the UI's geographic file list. Each item displays the filename
   * and includes a tooltip with additional file information, like file type, label attribute, and projection details.
   * A remove button is also provided to delete the layer from the list and handle associated cleanup.
   *
   * Parameters:
   * @param {string} filename - The name of the file, used as the display text and ID.
   * @param {string} color - The color used to style the filename text.
   * @param {string} fileext - The extension/type of the file; included in the tooltip.
   * @param {string} labelattribute - The label attribute used; included in the tooltip.
   * @param {Object} externalProjection - The projection details; included in the tooltip.
   *
   * Behavior:
   * - Creates a list item styled with CSS properties for layout and hover effects.
   * - Displays the filename in the specified color, with text overflow handling.
   * - Provides additional file details in a tooltip triggered on hover.
   * - Adds a remove button to each list item, invoking the `removeGeometryLayer` function when clicked.
   * - Appends each configured list item to the global `geolist` element for UI rendering.
   ****************************************************************************************/
  function addToGeoList(filename, color, fileext, labelattribute, externalProjection) {
    let liObj = document.createElement("li");
    liObj.id = filename.replace(/[^a-z0-9_-]/gi, "_");

    liObj.style.position = "relative";
    liObj.style.padding = "2px 2px";
    liObj.style.margin = "2px 0";
    liObj.style.background = "transparent";
    liObj.style.borderRadius = "3px";
    liObj.style.display = "flex";
    liObj.style.justifyContent = "space-between";
    liObj.style.alignItems = "center";
    liObj.style.transition = "background 0.2s";
    liObj.style.fontSize = "0.95em";

    liObj.addEventListener("mouseover", function () {
      liObj.style.background = "#eaeaea";
    });
    liObj.addEventListener("mouseout", function () {
      liObj.style.background = "transparent";
    });

    let fileText = document.createElement("span");
    fileText.style.color = color;
    fileText.innerHTML = filename;
    fileText.style.flexGrow = "1";
    fileText.style.flexShrink = "1";
    fileText.style.flexBasis = "auto";
    fileText.style.overflow = "hidden";
    fileText.style.textOverflow = "ellipsis";
    fileText.style.whiteSpace = "nowrap";
    fileText.style.marginRight = "5px";
    //liObj.appendChild(fileText);

    // Create the tooltip content
    const tooltipContent = `File Type: ${fileext}\nLabel: ${labelattribute}\nProjection: ${externalProjection}`;
    fileText.title = tooltipContent; // Set the tooltip
    liObj.appendChild(fileText);

    let removeButton = document.createElement("button");
    removeButton.innerHTML = "X";
    removeButton.style.flex = "none";
    removeButton.style.backgroundColor = "#E57373";
    removeButton.style.color = "white";
    removeButton.style.border = "none";
    removeButton.style.padding = "0";
    removeButton.style.width = "16px";
    removeButton.style.height = "16px";
    removeButton.style.cursor = "pointer";
    removeButton.style.marginLeft = "3px";
    removeButton.addEventListener("click", () => removeGeometryLayer(filename));
    liObj.appendChild(removeButton);

    geolist.appendChild(liObj);
  }

  function createButton(text, color, mouseoverColor, type = "button", labelFor = "") {
    let element;

    if (type === "label") {
      element = document.createElement("label");
      element.textContent = text;

      if (labelFor) {
        element.htmlFor = labelFor;
      }
    } else if (type === "input") {
      element = document.createElement("input");
      element.type = "button"; // Input elements need a type attribute

      element.value = text; // Use value for input types
    } else {
      element = document.createElement("button");
      element.textContent = text;
    }

    element.style.padding = "8px 0px";
    element.style.fontSize = "1rem";
    element.style.border = `2px solid ${color}`;
    element.style.borderRadius = "20px";
    element.style.cursor = "pointer";
    element.style.backgroundColor = color;
    element.style.color = "white";
    element.style.boxSizing = "border-box";
    element.style.transition = "background-color 0.3s, border-color 0.3s";
    element.style.fontWeight = "bold";
    element.style.textAlign = "center";
    element.style.display = "flex";
    element.style.justifyContent = "center";
    element.style.alignItems = "center";
    element.style.width = "100%";
    element.style.marginTop = "3px";
    element.style.marginLeft = "5px"; // Add small margin on the left
    element.style.marginRight = "5px"; // Add small margin on the right

    element.addEventListener("mouseover", function () {
      element.style.backgroundColor = mouseoverColor;
      element.style.borderColor = mouseoverColor;
    });

    element.addEventListener("mouseout", function () {
      element.style.backgroundColor = color;
      element.style.borderColor = color;
    });

    return element;
  }

  /***************************************************************************
   * removeGeometryLayer
   *
   * Description:
   * This function removes a specified geometry layer from the map, updates the stored layers,
   * and manages corresponding UI elements and local storage entries.
   *
   * Parameters:
   * @param {string} filename - The name of the file associated with the geometry layer to be removed.
   *
   * Behavior:
   * - Identifies and destroys the specified geometry layer from the map.
   * - Updates the `storedLayers` array by removing the layer corresponding to the filename.
   * - Identifies and removes UI elements associated with the layer:
   *   - The toggler item identified by the prefixed ID "t_[sanitizedFilename]".
   *   - The list item identified by the filename.
   * - Updates local storage:
   *   - Removes the entire storage entry if no layers remain.
   *   - Compresses and updates the storage entry with remaining layers if any exist.
   * - Logs the changes in local storage size.
   ****************************************************************************/
  function removeGeometryLayer(filename) {
    if (debug) {
      console.log(`${scriptName}: removeGeometryLayer(): called for (${filename})`);
    }

    const layerName = `Geometry: ${filename}`;
    const layers = W.map.getLayersBy("layerGroup", "wme_geometry");
    const layerToDestroy = layers.find((layer) => layer.name === layerName);

    if (!layerToDestroy) {
      console.log(`${scriptName}: removeGeometryLayer(): No layer found for (${filename})`);
      return;
    }

    // Destroy the layer
    layerToDestroy.destroy();

    // Update storedLayers by filtering out the removed layer
    storedLayers = storedLayers.filter((layer) => layer.filename !== filename);

    // Sanitize filename and define IDs
    const listItemId = filename.replace(/[^a-z0-9_-]/gi, "_");
    const layerTogglerId = `t_${listItemId}`;

    // Remove the toggler item if it exists
    const togglerItem = document.getElementById(layerTogglerId);
    if (togglerItem?.parentElement) {
      togglerItem.parentElement.removeChild(togglerItem);
    }

    const initialLocalStorageSize = localStorage.WMEGeoLayers ? localStorage.WMEGeoLayers.length / 1000 : 0;

    // Update local storage based on the remaining layers
    if (storedLayers.length === 0) {
      localStorage.removeItem("WMEGeoLayers");
      storedLayers = [];
    } else {
      localStorage.WMEGeoLayers = LZString.compress(JSON.stringify(storedLayers));
    }

    const newLocalStorageSize = localStorage.WMEGeoLayers ? localStorage.WMEGeoLayers.length / 1000 : 0;
    const sizeChange = newLocalStorageSize - initialLocalStorageSize;

    console.log(`${scriptName}: removeGeometryLayer(): Removed file (${filename}). Storage size changed by ${sizeChange}kB. Total size is now ${newLocalStorageSize}kB.`);

    // Remove any list item using the listItemId
    const listItem = document.getElementById(listItemId);
    if (listItem) {
      listItem.remove();
    }
  }

  /********************************************************************
   * createLayersFormats
   *
   * Description:
   * Initializes and returns an object of supported geometric data formats for use in parsing and rendering map data.
   * This function checks for the availability of various format parsers and creates instance objects for each, capturing
   * any parsing capabilities with error handling.
   *
   * Process:
   * - Verifies the availability of the `Wkt` library, logging an error if it is not loaded.
   * - Defines a helper function `tryCreateFormat` to instantiate format objects and log successes or errors.
   * - Attempts to create format instances for GEOJSON, WKT, KML, GPX, GML, OSM, and ZIP files of (SHP,SHX,DBF) using corresponding constructors.
   * - Continually builds a `formathelp` string that lists all formats successfully instantiated.
   * - Returns an object containing both the instantiated formats and the help string.
   *
   * Notes:
   * - Ensures debug logs are provided for tracing function execution when `debug` mode is active.
   **************************************************************/
  function createLayersFormats() {
    if (debug) console.log(`${scriptName}: createLayersFormats(): called`);

    let formats = {};
    let formathelp = "";

    function tryCreateFormat(formatName, FormatConstructor) {
      try {
        if (typeof FormatConstructor === "function") {
          formats[formatName] = new FormatConstructor();
          console.log(`${scriptName}: Successfully created format: ${formatName}`);
          formathelp += `${formatName} | `;
        } else {
          throw new Error(`${formatName} is not a valid constructor.`);
        }
      } catch (error) {
        console.error(`${scriptName}: ${formatName} format is not supported:`, error);
      }
    }

    tryCreateFormat("GEOJSON", OpenLayers.Format.GeoJSON);
    tryCreateFormat("WKT", GeoWKTer);
    tryCreateFormat("KML", OpenLayers.Format.KML);
    tryCreateFormat("GPX", GeoGPXer);
    tryCreateFormat("GML", OpenLayers.Format.GML);
    tryCreateFormat("OSM", OpenLayers.Format.OSM);

    // Add support for shapefile in ZIP form using shpjs
    // Note: 'shpjs' is not a constructor like other formats. It provides
    // a function 'shp()' used for parsing ZIP files containing Shapefiles,
    // and converting them to GEOJSON output.
    formats["ZIP"] = "shpjs"; // Using a string to denote usage of shpjs for ZIP
    console.log(`${scriptName}: Successfully created format: ZIP (shapefile)`);
    formathelp += "ZIP(SHP,SHX,DBF) | ";

    console.log(`${scriptName}: Finished loading formats.`);
    return { formats, formathelp };
  }

  /***********************************************************************************
   * addGroupToggler
   *
   * Description:
   * This function creates and adds a group toggler to a layer switcher UI component. It manages the visibility and interaction
   * of different layer groups within a map or similar UI, providing a toggling mechanism for user interface groups.
   *
   * Parameters:
   * @param {boolean} isDefault - A flag indicating whether the group is a default group.
   * @param {string} layerSwitcherGroupItemName - The unique name used as an identifier for the layer switcher group element.
   * @param {string} layerGroupVisibleName - The human-readable name for the layer group, shown in the UI.
   *
   * Returns:
   * @returns {HTMLElement} - The group element that has been created or modified.
   *
   * Behavior:
   * - If `isDefault` is true, it retrieves and operates on the existing group element related to the provided name.
   * - Otherwise, it dynamically creates a new group list item.
   * - Builds a toggler that includes a caret icon, a toggle switch, and a label displaying the group's visible name.
   * - Attaches event handlers to manage collapsible behavior of the group toggler and switches.
   * - Appends the configured group to the main UI component, either as an existing group or newly created one.
   * - Logs the creation of the group toggler to the console for debugging purposes.
   *****************************************************************************************/
  function addGroupToggler(isDefault, layerSwitcherGroupItemName, layerGroupVisibleName) {
    if (debug) console.log(`${scriptName}: addGroupToggler(): called`);

    var group;
    if (isDefault === true) {
      group = document.getElementById(layerSwitcherGroupItemName).parentElement.parentElement;
    } else {
      var layerGroupsList = document.getElementsByClassName("list-unstyled togglers")[0];
      group = document.createElement("li");
      group.className = "group";

      var togglerContainer = document.createElement("div");
      togglerContainer.className = "layer-switcher-toggler-tree-category";

      var groupButton = document.createElement("wz-button");
      groupButton.color = "clear-icon";
      groupButton.size = "xs";

      var iCaretDown = document.createElement("i");
      iCaretDown.className = "toggle-category w-icon w-icon-caret-down";
      iCaretDown.dataset.groupId = layerSwitcherGroupItemName.replace("layer-switcher-", "").toUpperCase();

      var togglerSwitch = document.createElement("wz-toggle-switch");
      togglerSwitch.className = layerSwitcherGroupItemName + " hydrated";
      togglerSwitch.id = layerSwitcherGroupItemName;
      togglerSwitch.checked = true;

      var label = document.createElement("label");
      label.className = "label-text";
      label.htmlFor = togglerSwitch.id;

      var togglerChildrenList = document.createElement("ul");
      togglerChildrenList.className = "collapsible-" + layerSwitcherGroupItemName.replace("layer-switcher-", "").toUpperCase();
      label.appendChild(document.createTextNode(layerGroupVisibleName));
      groupButton.addEventListener("click", layerTogglerGroupMinimizerEventHandler(iCaretDown));
      togglerSwitch.addEventListener("click", layerTogglerGroupMinimizerEventHandler(iCaretDown));
      groupButton.appendChild(iCaretDown);
      togglerContainer.appendChild(groupButton);
      togglerContainer.appendChild(togglerSwitch);
      togglerContainer.appendChild(label);
      group.appendChild(togglerContainer);
      group.appendChild(togglerChildrenList);
      layerGroupsList.appendChild(group);
    }

    if (debug) console.log(`${scriptName}: addGroupToggler(): Group Toggler created for ${layerGroupVisibleName}`);
    return group;
  }

  /******************************************************************************
   * addLayerToggler
   *
   * Description:
   * This function adds a toggler for individual layers within a group in a layer switcher UI component. It manages the visibility
   * and interaction for specific map layers, allowing users to toggle them on and off within a UI group.
   *
   * Parameters:
   * @param {HTMLElement} groupToggler - The parent group toggler element under which the layer toggler is added.
   * @param {string} layerName - The name of the layer, used for display and creating unique identifiers.
   * @param {Object} layerObj - The layer object that is being toggled, typically representing a map or UI layer.
   *
   * Behavior:
   * - Locates the container (UL) within the group toggler where new layer togglers are to be appended.
   * - Creates a checkbox element for the layer, setting it to checked by default for visibility.
   * - Attaches events to both the individual layer checkbox and the group checkbox for toggling functionality.
   * - Appends the fully configured toggler to the UI.
   * - Logs the creation of the layer toggler for debugging purposes.
   *******************************************************************************************/
  function addLayerToggler(groupToggler, layerName, layerObj) {
    if (debug) console.log(`${scriptName}: addLayerToggler(): called`);

    var layer_container = groupToggler.getElementsByTagName("UL")[0];
    var layerGroupCheckbox = groupToggler.getElementsByClassName("layer-switcher-toggler-tree-category")[0].getElementsByTagName("wz-toggle-switch")[0];
    var toggler = document.createElement("li");
    var togglerCheckbox = document.createElement("wz-checkbox");
    togglerCheckbox.setAttribute("checked", "true");

    // Generate ID for togglerCheckbox using layerName
    var togglerId = layerName.replace(/[^a-z0-9_-]/gi, "_");
    togglerCheckbox.id = "t_" + togglerId;

    togglerCheckbox.className = "hydrated";
    togglerCheckbox.appendChild(document.createTextNode(layerName));
    toggler.appendChild(togglerCheckbox);
    layer_container.appendChild(toggler);
    togglerCheckbox.addEventListener("change", layerTogglerEventHandler(layerObj));
    layerGroupCheckbox.addEventListener("change", layerTogglerGroupEventHandler(togglerCheckbox, layerObj));
    layerTogglerEventHandler(layerObj);
    layerTogglerGroupEventHandler(togglerCheckbox, layerObj);

    if (debug) console.log(`${scriptName}: addLayerToggler(): Layer Toggler created for ${layerName}`);
  }

  function layerTogglerEventHandler(layerObj) {
    return function () {
      const isVisible = this.checked;
      // Toggle the visibility of the layer
      layerObj.setVisibility(isVisible);
    };
  }

  function layerTogglerGroupEventHandler(groupCheckbox, layerObj) {
    return function () {
      // Determine if the layer should be visible based on the checkboxes
      const shouldBeVisible = this.checked && groupCheckbox.checked;

      // Set the layer's visibility directly
      layerObj.setVisibility(shouldBeVisible);

      // Optionally adjust checkbox behavior, depending on what you want
      groupCheckbox.disabled = !this.checked;
      if (!groupCheckbox.checked) {
        groupCheckbox.disabled = false;
      }
    };
  }

  function layerTogglerGroupMinimizerEventHandler(iCaretDown) {
    return function () {
      const ulCollapsible = iCaretDown.closest("li").querySelector("ul");
      iCaretDown.classList.toggle("upside-down");
      ulCollapsible.classList.toggle("collapse-layer-switcher-group");
    };
  }

  function installPathFollowingLabels() {
    if (debug) console.log(`${scriptName}: Patching Openlayers.Style with installPathFollowingLabels()........`);

    // Copyright (c) 2015 by Jean-Marc.Viglino [at]ign.fr
    // Dual-licensed under the CeCILL-B Licence (http://www.cecill.info/)
    // and the Beerware license (http://en.wikipedia.org/wiki/Beerware),
    // feel free to use and abuse it in your projects (the code, not the beer ;-).
    //
    //* Overwrite the SVG function to allow text along a path
    //*	setStyle function
    //*
    //*	Add new options to the Openlayers.Style

    // pathLabel: {String} Label to draw on the path
    // pathLabelXOffset: {String} Offset along the line to start drawing text in pixel or %, default: "50%"
    // pathLabelYOffset: {Number} Distance of the line to draw the text
    // pathLabelCurve: {String} Smooth the line the label is drawn on (empty string for no)
    // pathLabelReadable: {String} Make the label readable (empty string for no)

    // *	Extra standard values : all label and text values

    //  *
    //  * Method: removeChildById
    //  * Remove child in a node.
    //  *

    function removeChildById(node, id) {
      if (node.querySelector) {
        var c = node.querySelector("#" + id);
        if (c) node.removeChild(c);
        return;
      }
      // For old browsers
      var c = node.childNodes;
      if (c)
        for (var i = 0; i < c.length; i++) {
          if (c[i].id === id) {
            node.removeChild(c[i]);
            return;
          }
        }
    }

    //  *
    //  * Method: setStyle
    //  * Use to set all the style attributes to a SVG node.
    //  *
    //  * Takes care to adjust stroke width and point radius to be
    //  * resolution-relative
    //  *
    //  * Parameters:
    //  * node - {SVGDomElement} An SVG element to decorate
    //  * style - {Object}
    //  * options - {Object} Currently supported options include
    //  *                              'isFilled' {Boolean} and
    //  *                              'isStroked' {Boolean}

    var setStyle = OpenLayers.Renderer.SVG.prototype.setStyle;
    OpenLayers.Renderer.SVG.LABEL_STARTOFFSET = { l: "0%", r: "100%", m: "50%" };

    OpenLayers.Renderer.SVG.prototype.pathText = function (node, style, suffix) {
      var label = this.nodeFactory(null, "text");
      label.setAttribute("id", node._featureId + "_" + suffix);
      if (style.fontColor) label.setAttributeNS(null, "fill", style.fontColor);
      if (style.fontStrokeColor) label.setAttributeNS(null, "stroke", style.fontStrokeColor);
      if (style.fontStrokeWidth) label.setAttributeNS(null, "stroke-width", style.fontStrokeWidth);
      if (style.fontOpacity) label.setAttributeNS(null, "opacity", style.fontOpacity);
      if (style.fontFamily) label.setAttributeNS(null, "font-family", style.fontFamily);
      if (style.fontSize) label.setAttributeNS(null, "font-size", style.fontSize);
      if (style.fontWeight) label.setAttributeNS(null, "font-weight", style.fontWeight);
      if (style.fontStyle) label.setAttributeNS(null, "font-style", style.fontStyle);
      if (style.labelSelect === true) {
        label.setAttributeNS(null, "pointer-events", "visible");
        label._featureId = node._featureId;
      } else {
        label.setAttributeNS(null, "pointer-events", "none");
      }

      function getpath(pathStr, readeable) {
        var npath = pathStr.split(",");
        var pts = [];
        if (!readeable || Number(npath[0]) - Number(npath[npath.length - 2]) < 0) {
          while (npath.length) pts.push({ x: Number(npath.shift()), y: Number(npath.shift()) });
        } else {
          while (npath.length) pts.unshift({ x: Number(npath.shift()), y: Number(npath.shift()) });
        }
        return pts;
      }

      var path = this.nodeFactory(null, "path");
      var tpid = node._featureId + "_t" + suffix;
      var tpath = node.getAttribute("points");
      if (style.pathLabelCurve) {
        var pts = getpath(tpath, style.pathLabelReadable);
        var p = pts[0].x + " " + pts[0].y;
        var dx, dy, s1, s2;
        dx = (pts[0].x - pts[1].x) / 4;
        dy = (pts[0].y - pts[1].y) / 4;
        for (var i = 1; i < pts.length - 1; i++) {
          p += " C " + (pts[i - 1].x - dx) + " " + (pts[i - 1].y - dy);
          dx = (pts[i - 1].x - pts[i + 1].x) / 4;
          dy = (pts[i - 1].y - pts[i + 1].y) / 4;
          s1 = Math.sqrt(Math.pow(pts[i - 1].x - pts[i].x, 2) + Math.pow(pts[i - 1].y - pts[i].y, 2));
          s2 = Math.sqrt(Math.pow(pts[i + 1].x - pts[i].x, 2) + Math.pow(pts[i + 1].y - pts[i].y, 2));
          p += " " + (pts[i].x + (s1 * dx) / s2) + " " + (pts[i].y + (s1 * dy) / s2);
          dx *= s2 / s1;
          dy *= s2 / s1;
          p += " " + pts[i].x + " " + pts[i].y;
        }
        p += " C " + (pts[i - 1].x - dx) + " " + (pts[i - 1].y - dy);
        dx = (pts[i - 1].x - pts[i].x) / 4;
        dy = (pts[i - 1].y - pts[i].y) / 4;
        p += " " + (pts[i].x + dx) + " " + (pts[i].y + dy);
        p += " " + pts[i].x + " " + pts[i].y;

        path.setAttribute("d", "M " + p);
      } else {
        if (style.pathLabelReadable) {
          var pts = getpath(tpath, style.pathLabelReadable);
          var p = "";
          for (var i = 0; i < pts.length; i++) p += " " + pts[i].x + " " + pts[i].y;
          path.setAttribute("d", "M " + p);
        } else path.setAttribute("d", "M " + tpath);
      }
      path.setAttribute("id", tpid);

      var defs = this.createDefs();
      removeChildById(defs, tpid);
      defs.appendChild(path);

      var textPath = this.nodeFactory(null, "textPath");
      textPath.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#" + tpid);
      var align = style.labelAlign || OpenLayers.Renderer.defaultSymbolizer.labelAlign;
      label.setAttributeNS(null, "text-anchor", OpenLayers.Renderer.SVG.LABEL_ALIGN[align[0]] || "middle");
      textPath.setAttribute("startOffset", style.pathLabelXOffset || OpenLayers.Renderer.SVG.LABEL_STARTOFFSET[align[0]] || "50%");
      label.setAttributeNS(null, "dominant-baseline", OpenLayers.Renderer.SVG.LABEL_ALIGN[align[1]] || "central");
      if (style.pathLabelYOffset) label.setAttribute("dy", style.pathLabelYOffset);
      //textPath.setAttribute('method','stretch');
      //textPath.setAttribute('spacing','auto');

      textPath.textContent = style.pathLabel;
      label.appendChild(textPath);

      removeChildById(this.textRoot, node._featureId + "_" + suffix);
      this.textRoot.appendChild(label);
    };

    OpenLayers.Renderer.SVG.prototype.setStyle = function (node, style, options) {
      if (node._geometryClass === "OpenLayers.Geometry.LineString" && style.pathLabel) {
        if (node._geometryClass === "OpenLayers.Geometry.LineString" && style.pathLabel) {
          var drawOutline = !!style.labelOutlineWidth;
          // First draw text in halo color and size and overlay the
          // normal text afterwards
          if (drawOutline) {
            var outlineStyle = OpenLayers.Util.extend({}, style);
            outlineStyle.fontColor = outlineStyle.labelOutlineColor;
            outlineStyle.fontStrokeColor = outlineStyle.labelOutlineColor;
            outlineStyle.fontStrokeWidth = style.labelOutlineWidth;
            if (style.labelOutlineOpacity) outlineStyle.fontOpacity = style.labelOutlineOpacity;
            delete outlineStyle.labelOutlineWidth;
            this.pathText(node, outlineStyle, "txtpath0");
          }
          this.pathText(node, style, "txtpath");
          setStyle.apply(this, arguments);
        }
      } else setStyle.apply(this, arguments);
      return node;
    };

    //  *
    //  * Method: drawGeometry
    //  * Remove the textpath if no geometry is drawn.
    //  *
    //  * Parameters:
    //  * geometry - {<OpenLayers.Geometry>}
    //  * style - {Object}
    //  * featureId - {String}
    //  *
    //  * Returns:
    //  * {Boolean} true if the geometry has been drawn completely; null if
    //  *     incomplete; false otherwise

    var drawGeometry = OpenLayers.Renderer.SVG.prototype.drawGeometry;
    OpenLayers.Renderer.SVG.prototype.drawGeometry = function (geometry, style, id) {
      var rendered = drawGeometry.apply(this, arguments);
      if (rendered === false) {
        removeChildById(this.textRoot, id + "_txtpath");
        removeChildById(this.textRoot, id + "_txtpath0");
      }
      return rendered;
    };

    // *
    // * Method: eraseGeometry
    // * Erase a geometry from the renderer. In the case of a multi-geometry,
    // *     we cycle through and recurse on ourselves. Otherwise, we look for a
    // *     node with the geometry.id, destroy its geometry, and remove it from
    // *     the DOM.
    // *
    // * Parameters:
    // * geometry - {<OpenLayers.Geometry>}
    // * featureId - {String}

    var eraseGeometry = OpenLayers.Renderer.SVG.prototype.eraseGeometry;
    OpenLayers.Renderer.SVG.prototype.eraseGeometry = function (geometry, featureId) {
      eraseGeometry.apply(this, arguments);
      removeChildById(this.textRoot, featureId + "_txtpath");
      removeChildById(this.textRoot, featureId + "_txtpath0");
    };
    if (debug) console.log(`${scriptName}: installPathFollowingLabels() installed!`);
  }

  // Initialize your script
  if (W?.userscripts?.state.isInitialized) {
    init();
  } else {
    document.addEventListener("wme-initialized", init, { once: true });
  }
};
geometries();
