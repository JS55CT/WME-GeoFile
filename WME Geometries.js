// ==UserScript==
// @name                WME Geometries (JS55CT Fork)
// @namespace           https://github.com/JS55CT
// @description         Import geometry files into Waze Map Editor. Supports GeoJSON, GML, WKT, KML, and GPX (Modified from original).
// @version             2023.11.04.0
// @downloadURL         https://raw.githubusercontent.com/JS55CT/WME-Geometries-JS55CT-Fork/main/WME%20Geometries.js
// @updateURL           https://raw.githubusercontent.com/JS55CT/WME-Geometries-JS55CT-Fork/main/WME%20Geometries.js
// @author              JS55CT
// @match               https://www.waze.com/*/editor*
// @match               https://www.waze.com/editor*
// @match               https://beta.waze.com/*
// @exclude             https://www.waze.com/*user/*editor/*
// @require             https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js
// @require             https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @require             https://openlayers.org/api/OpenLayers.js
// @grant               none
// @license             MIT
// @original-author     Timbones
// @original-contributors wlodek76, Twister-UK
// @original-source     https://greasyfork.org/en/scripts/8129-wme-geometries
// ==/UserScript==

/* JSHint Directives */
/* globals OpenLayers: true */
/* globals LZString: true */
/* globals W: true */
/* globals $: true */
/* globals I18n: true */
/* jshint bitwise: false */
/* jshint evil: true */
/* jshint esversion: 6 */

var geometries = function () {
  "use strict";
  const scriptMetadata = GM_info.script; // Metadata for the script
  let maxlabels = 100000; // maximum number of features that will be shown with labels

  // show labels using first attribute that starts or ends with "name" (case insensitive regexp)
  let labelname = /^name|name$/;
  let geolist;
  let formathelp = "GeoJSON, WKT";
  let formats = { GEOJSON: new OpenLayers.Format.GeoJSON(), WKT: new OpenLayers.Format.WKT() };
  patchOpenLayers(); // patch adds KML, GPX and TXT formats

  let EPSG_4326 = new OpenLayers.Projection("EPSG:4326"); // lat,lon
  let EPSG_4269 = new OpenLayers.Projection("EPSG:4269"); // NAD 83
  let EPSG_3857 = new OpenLayers.Projection("EPSG:3857"); // WGS 84

  let layerindex = 0;
  let storedLayers = [];

  function layerStoreObj(fileContent, color, fileext, filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos) {
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
  }
  function loadLayers() {
    // Parse any locally stored layer objects
    if (localStorage.WMEGeoLayers != undefined) {
      storedLayers = JSON.parse(LZString.decompress(localStorage.WMEGeoLayers));
      for (layerindex = 0; layerindex < storedLayers.length; ++layerindex) {
        parseFile(storedLayers[layerindex]);
      }
    } else {
      storedLayers = [];
    }
  }
  // add interface to WME Scripts tab </>
  function init() {
    console.group("WME Geometries: Loading GEO tab...");
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

      // Create the custom label
      let customLabel = document.createElement("label");
      customLabel.htmlFor = "GeometryFile";
      customLabel.innerText = "Import GEO File";
      customLabel.style.padding = "8px 0px";
      customLabel.style.fontSize = "1rem";
      customLabel.style.cursor = "pointer";
      customLabel.style.border = "2px solid #8BC34A"; // Light green border
      customLabel.style.borderRadius = "20px";
      customLabel.style.backgroundColor = "#8BC34A"; // Light green background
      customLabel.style.color = "white";
      customLabel.style.display = "block";
      customLabel.style.width = "100%";
      customLabel.style.boxSizing = "border-box";
      customLabel.style.textAlign = "center";
      customLabel.style.transition = "background-color 0.3s, border-color 0.3s";

      // Add hover effect for custom label
      customLabel.addEventListener("mouseover", function () {
        customLabel.style.backgroundColor = "#689F38"; // Slightly darker green
        customLabel.style.borderColor = "#689F38";
      });

      customLabel.addEventListener("mouseout", function () {
        customLabel.style.backgroundColor = "#8BC34A"; // Original green background
        customLabel.style.borderColor = "#8BC34A";
      });

      // Append the input file and custom label to the container
      fileContainer.appendChild(inputfile);
      fileContainer.appendChild(customLabel);

      // Append the container to the form
      geoform.appendChild(fileContainer);

      // Add change event listener to the input file
      inputfile.addEventListener("change", addGeometryLayer, false);

      let notes = document.createElement("p");
      notes.innerHTML = "<b>Formats:</b> " + formathelp + "<br> <b>Coordinates:</b> EPSG:4326, EPSG:3857";
      notes.style.color = "#555";
      notes.style.display = "block";
      notes.style.fontSize = "0.9em";
      notes.style.marginLeft = "0px";
      notes.style.marginBottom = "0px";
      geoform.appendChild(notes);

      // Creates the State Boubdary Button
      let inputstate = document.createElement("input");
      inputstate.type = "button";
      inputstate.value = "Draw State Boundary";
      inputstate.title = "Draw the Boundary for the State in focus";
      inputstate.style.padding = "8px 0px";
      inputstate.style.fontSize = "1rem";
      inputstate.style.border = "2px solid #87CEEB"; // Light blue border
      inputstate.style.borderRadius = "20px";
      inputstate.style.cursor = "pointer";
      inputstate.style.backgroundColor = "#87CEEB"; // Light blue background
      inputstate.style.color = "white";
      inputstate.style.display = "block";
      inputstate.style.width = "100%";
      inputstate.style.boxSizing = "border-box";
      inputstate.style.textAlign = "center";
      inputstate.style.marginTop = "10px";
      inputstate.style.transition = "background-color 0.3s, border-color 0.3s";

      // Add hover effect for the state boundary button
      inputstate.addEventListener("mouseover", function () {
        inputstate.style.backgroundColor = "#5DADE2"; // Slightly darker blue
        inputstate.style.borderColor = "#5DADE2";
      });

      inputstate.addEventListener("mouseout", function () {
        inputstate.style.backgroundColor = "#87CEEB"; // Original blue background
        inputstate.style.borderColor = "#87CEEB";
      });

      inputstate.addEventListener("click", drawStateBoundary);
      geoform.appendChild(inputstate);

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

      // Add the Import WKT Button
      let submit_WKT_btn = document.createElement("input");
      submit_WKT_btn.type = "button";
      submit_WKT_btn.id = "submit_WKT_btn";
      submit_WKT_btn.value = "Import WKT";
      submit_WKT_btn.title = "Import WKT Geometry to WME Layer";
      submit_WKT_btn.style.padding = "8px 20px";
      submit_WKT_btn.style.fontSize = "1rem";
      submit_WKT_btn.style.border = "2px solid #8BC34A"; // Light green border
      submit_WKT_btn.style.borderRadius = "20px";
      submit_WKT_btn.style.cursor = "pointer";
      submit_WKT_btn.style.backgroundColor = "#8BC34A"; // Light green background
      submit_WKT_btn.style.color = "white";
      submit_WKT_btn.style.boxSizing = "border-box";
      submit_WKT_btn.style.transition = "background-color 0.3s, border-color 0.3s";
      // Add hover effect for submit button
      submit_WKT_btn.addEventListener("mouseover", function () {
        submit_WKT_btn.style.backgroundColor = "#689F38"; // Darker green background on hover
        submit_WKT_btn.style.borderColor = "#689F38"; // Darker green border on hover
      });

      submit_WKT_btn.addEventListener("mouseout", function () {
        submit_WKT_btn.style.backgroundColor = "#8BC34A"; // Original green background
        submit_WKT_btn.style.borderColor = "#8BC34A"; // Original green border
      });

      submit_WKT_btn.addEventListener("click", draw_WKT);
      buttonContainer.appendChild(submit_WKT_btn);

      // Add the Clear WKT Button
      let clear_WKT_btn = document.createElement("input");
      clear_WKT_btn.type = "button";
      clear_WKT_btn.id = "clear_WKT_btn";
      clear_WKT_btn.value = "Clear WKT";
      clear_WKT_btn.title = "Clear WKT Geometry Input and Name";
      clear_WKT_btn.style.padding = "8px 20px";
      clear_WKT_btn.style.fontSize = "1rem";
      clear_WKT_btn.style.border = "2px solid #E57373"; // Light red border
      clear_WKT_btn.style.borderRadius = "20px";
      clear_WKT_btn.style.cursor = "pointer";
      clear_WKT_btn.style.backgroundColor = "#E57373"; // Light red background
      clear_WKT_btn.style.color = "white";
      clear_WKT_btn.style.boxSizing = "border-box";
      clear_WKT_btn.style.transition = "background-color 0.3s, border-color 0.3s";
      // Add hover effect for clear button
      clear_WKT_btn.addEventListener("mouseover", function () {
        clear_WKT_btn.style.backgroundColor = "#D32F2F"; // Darker red background
        clear_WKT_btn.style.borderColor = "#D32F2F";
      });

      clear_WKT_btn.addEventListener("mouseout", function () {
        clear_WKT_btn.style.backgroundColor = "#E57373"; // Original red background
        clear_WKT_btn.style.borderColor = "#E57373";
      });

      clear_WKT_btn.addEventListener("click", clear_WKT_input);
      buttonContainer.appendChild(clear_WKT_btn);

      wktContainer.appendChild(buttonContainer);

      // Append the container to the form
      geoform.appendChild(wktContainer);

      console.groupEnd("WME Geometries: initialised");
      loadLayers();
    });
  }

  function draw_WKT() {
    // Add variables from Options input section to WKT input geo
    let color = document.getElementById("color").value;
    let fillOpacity = document.getElementById("fill_opacity").value;
    let fontsize = document.getElementById("font_size").value;
    let lineopacity = document.getElementById("line_stroke_opacity").value;
    let linesize = document.getElementById("line_size").value;
    let linestyle = document.querySelector('input[name="line_stroke_style"]:checked').value;
    let layerName = document.getElementById("input_WKT_name").value;
    let labelpos = document.querySelector('input[name="label_pos_horizontal"]:checked').value + document.querySelector('input[name="label_pos_vertical"]:checked').value;

    let layers = W.map.getLayersBy("layerGroup", "wme_geometry");
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].name === "Geometry: " + layerName) {
        console.info("WME Geometries: current WKT layer name already used");
        return;
      }
    }

    let val_from_WKT_textarea = document.getElementById("input_WKT").value;
    let wkt_format = new OpenLayers.Format.WKT();
    let input_to_WKT_read = wkt_format.read(val_from_WKT_textarea); // Convert textarea input to WKT feature vector obj

    // Convert WKT to GeoJSON using OpenLayers format conversion
    let geojson_format = new OpenLayers.Format.GeoJSON();
    let convert_WKT_to_geojson = geojson_format.write(input_to_WKT_read); // Convert WKT to GeoJSON

    // Ensure the GeoJSON is serialized safely
    let serialized_geojson = JSON.stringify(JSON.parse(convert_WKT_to_geojson));

    let geojson_to_layer_obj = new layerStoreObj(serialized_geojson, color, "GEOJSON", layerName, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos);
    storedLayers.push(geojson_to_layer_obj); // Push GeoJSON object to storedLayers

    parseFile(geojson_to_layer_obj); // Send GeoJSON to parseFile function
    localStorage.WMEGeoLayers = LZString.compress(JSON.stringify(storedLayers)); // Compress stored layers to save space in localStorage

    console.info(`WME Geometries: Stored WKT Input - ${layerName} : ${localStorage.WMEGeoLayers.length / 1000} kB in localStorage`);
  }

  function drawStateBoundary() {
    // add formating Options and locaal storage for WME refresh availability to Draw State Boundary functionality
    let color = document.getElementById("color").value;
    let fillOpacity = document.getElementById("fill_opacity").value;
    let fontsize = document.getElementById("font_size").value;
    let lineopacity = document.getElementById("line_stroke_opacity").value;
    let linesize = document.getElementById("line_size").value;
    let linestyle = document.querySelector('input[name="line_stroke_style"]:checked').value;
    let labelpos = document.querySelector('input[name="label_pos_horizontal"]:checked').value + document.querySelector('input[name="label_pos_vertical"]:checked').value;

    if (!W.model.topState || !W.model.topState.attributes || !W.model.topState.attributes.geometry) {
      console.info("WME Geometries: no state or geometry available, sorry");
      WazeWrap.Alerts.info(scriptMetadata.name, "No State or Geometry Available, Sorry!");
      return;
    }
    let layerName = `(${W.model.topState.attributes.name})`;
    let layers = W.map.getLayersBy("layerGroup", "wme_geometry");
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].name == "Geometry: " + layerName) {
        console.info("WME Geometries: current state already loaded");
        WazeWrap.Alerts.info(scriptMetadata.name, "Current State Boundary already Loaded!");
        return;
      }
    }

    let state_geo = W.model.topState.attributes.geometry;
    let state_geo_to_json = JSON.stringify(state_geo); // Serialize the GeoJSON object safely
    let state_obj = new layerStoreObj(state_geo_to_json, color, "GEOJSON", layerName, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos);
    storedLayers.push(state_obj);
    parseFile(state_obj);
    localStorage.WMEGeoLayers = LZString.compress(JSON.stringify(storedLayers));
    console.info(`WME Geometries: Stored the State of ${layerName} : ${localStorage.WMEGeoLayers.length / 1000} kB in localStorage`);
  }

  // Clears the current contents of the textarea.
  function clear_WKT_input() {
    document.getElementById("input_WKT").value = "";
    document.getElementById("input_WKT_name").value = "";
  }

  // import selected file as a vector layer
  function addGeometryLayer() {
    let fileList = document.getElementById("GeometryFile");
    let file = fileList.files[0];
    fileList.value = "";
    let fileext = file.name.split(".").pop();
    let filename = file.name.replace("." + fileext, "");
    fileext = fileext.toUpperCase();

    // Add variables from Options input section
    let color = document.getElementById("color").value;
    let fillOpacity = document.getElementById("fill_opacity").value;
    let fontsize = document.getElementById("font_size").value;
    let lineopacity = document.getElementById("line_stroke_opacity").value;
    let linesize = document.getElementById("line_size").value;
    let linestyle = document.querySelector('input[name="line_stroke_style"]:checked').value;
    let labelpos = document.querySelector('input[name="label_pos_horizontal"]:checked').value + document.querySelector('input[name="label_pos_vertical"]:checked').value;

    let fileitem = document.getElementById(filename.replace(/[^a-z0-9_-]/gi, "_"));
    if (!fileitem) {
      fileitem = document.createElement("li");
      fileitem.id = filename.replace(/[^a-z0-9_-]/gi, "_");

      // Style the list item
      fileitem.style.position = "relative";
      fileitem.style.padding = "2px 2px";
      fileitem.style.margin = "2px 0"; // Adjust margin to be smaller
      fileitem.style.background = "transparent";
      fileitem.style.borderRadius = "3px";
      fileitem.style.display = "flex";
      fileitem.style.justifyContent = "space-between";
      fileitem.style.alignItems = "center";
      fileitem.style.transition = "background 0.2s";
      fileitem.style.fontSize = "0.95em";

      // Add hover effect
      fileitem.addEventListener("mouseover", function () {
        fileitem.style.background = "#eaeaea";
      });
      fileitem.addEventListener("mouseout", function () {
        fileitem.style.background = "transparent";
      });

      geolist.appendChild(fileitem);
    }

    let fileText = document.createElement("span");
    fileText.style.color = color;
    fileText.innerHTML = "Loading...";
    fileText.style.flexGrow = "1";
    fileText.style.lineHeight = "1";
    fileText.style.fontSize = "0.95em";
    fileitem.appendChild(fileText);

    // Remove button
    let removeButton = document.createElement("button");
    removeButton.style.cursor = "pointer";
    removeButton.style.backgroundColor = "#E57373"; // Light red background
    removeButton.style.color = "white";
    removeButton.style.border = "none";
    removeButton.style.padding = "0px 0px 0px 0px"; // Adjust padding to be smaller
    removeButton.style.borderRadius = "3px";
    removeButton.innerHTML = "X";
    removeButton.style.fontSize = "1.0em";
    removeButton.style.width = "16px"; // Make button square
    removeButton.style.height = "16px"; // Make button square
    removeButton.style.marginLeft = "3px"; // Add some spacing from the text
    removeButton.addEventListener("click", () => removeGeometryLayer(filename));
    fileitem.appendChild(removeButton);

    // Check if format is supported
    let parser = formats[fileext];
    if (typeof parser == "undefined") {
      fileitem.innerHTML = fileext.toUpperCase() + " format not supported :(";
      fileitem.style.color = "red";
      return;
    }

    // Read the file into the new layer, and update the localStorage layer cache
    let reader = new FileReader();
    reader.onload = (function (theFile) {
      return function (e) {
        requestAnimationFrame(() => {
          let tObj = new layerStoreObj(e.target.result, color, fileext, filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos);
          storedLayers.push(tObj);
          parseFile(tObj);
          localStorage.WMEGeoLayers = LZString.compress(JSON.stringify(storedLayers));
          console.info(`WME Geometries: stored file - ${fileitem.id} : ${localStorage.WMEGeoLayers.length / 1000} kB in localStorage`);
        });
      };
    })(file);
    reader.readAsText(file);
  }

  function parseFile(layerObj) {
    let layerStyle = {
      strokeColor: layerObj.color,
      strokeOpacity: layerObj.lineopacity,
      strokeWidth: layerObj.linesize,
      strokeDashstyle: layerObj.linestyle,
      fillColor: layerObj.color,
      fillOpacity: layerObj.fillOpacity,
      pointRadius: 20,
      fontColor: layerObj.color,
      fontSize: layerObj.fontsize,
      labelOutlineColor: "black",
      labelOutlineWidth: layerObj.fontsize / 4,
      labelAlign: layerObj.labelpos,
      label: "", // Placeholder for label
    };

    let parser = formats[layerObj.fileext];
    parser.internalProjection = W.map.getProjectionObject();
    parser.externalProjection = EPSG_4326;

    if (/"EPSG:3857"/.test(layerObj.fileContent) || /:EPSG::3857"/.test(layerObj.fileContent)) {
      parser.externalProjection = EPSG_3857;
    } else if (/"EPSG:4269"/.test(layerObj.fileContent) || /:EPSG::4269"/.test(layerObj.fileContent)) {
      parser.externalProjection = EPSG_4269;
    }

    let features = parser.read(layerObj.fileContent);

    let labelwith = "(no labels)";
    let labelAttribute = "";

    // Declare WME_Geometry outside of the conditional block
    let WME_Geometry;

    if (features.length > 0) {
      if (features.length <= maxlabels) {
        for (let attrib in features[0].attributes) {
          if (labelname.test(attrib.toLowerCase())) {
            if (typeof features[0].attributes[attrib] === "string") {
              labelwith = "Attribute used for Labels: " + attrib;
              layerStyle.label = "${formatLabel}";
              labelAttribute = attrib;
              break;
            }
          }
        }
      }

      let labelContext = {
        formatLabel: function (feature) {
          if (labelAttribute && feature.attributes.hasOwnProperty(labelAttribute)) {
            let labelValue = feature.attributes[labelAttribute];
            labelValue = labelValue.replace(/\|/g, "\n");
            return labelValue;
          } else {
            return "";
          }
        },
      };

      let defaultStyle = new OpenLayers.Style(layerStyle, { context: labelContext });

      let layerid = "wme_geometry_" + layerindex;
      WME_Geometry = new OpenLayers.Layer.Vector("Geometry: " + layerObj.filename, {
        rendererOptions: { zIndexing: true },
        uniqueName: layerid,
        shortcutKey: "S+" + layerindex,
        layerGroup: "wme_geometry",
      });

      WME_Geometry.setZIndex(-9999);
      WME_Geometry.displayInLayerSwitcher = true;
      I18n.translations[I18n.locale].layers.name[layerid] = "WME Geometries: " + layerObj.filename;

      WME_Geometry.styleMap = new OpenLayers.StyleMap(defaultStyle);
      WME_Geometry.addFeatures(features);
      W.map.addLayer(WME_Geometry);
    }

    let liObj = document.getElementById(layerObj.filename.replace(/[^a-z0-9_-]/gi, "_"));
    if (!liObj) {
      liObj = document.createElement("li");
      liObj.id = layerObj.filename.replace(/[^a-z0-9_-]/gi, "_");

      // Style the list item
      liObj.style.position = "relative";
      liObj.style.padding = "2px 2px";
      liObj.style.margin = "2px 0"; // Adjust margin to be smaller
      liObj.style.background = "transparent";
      liObj.style.borderRadius = "3px";
      liObj.style.display = "flex";
      liObj.style.justifyContent = "space-between";
      liObj.style.alignItems = "center";
      liObj.style.transition = "background 0.2s";
      liObj.style.fontSize = "0.95em";

      // Add hover effect
      liObj.addEventListener("mouseover", function () {
        liObj.style.background = "#eaeaea";
      });
      liObj.addEventListener("mouseout", function () {
        liObj.style.background = "transparent";
      });

      let span = document.createElement("span");
      span.style.color = layerObj.color;
      span.innerHTML = "Loading...";
      span.style.flexGrow = "1";
      span.style.lineHeight = "1";
      span.style.fontSize = "0.95em";
      liObj.appendChild(span);

      // Remove button
      let removeButton = document.createElement("button");
      removeButton.style.cursor = "pointer";
      removeButton.style.backgroundColor = "#E57373"; // Light red background
      removeButton.style.color = "white";
      removeButton.style.border = "none";
      removeButton.style.padding = "0px 0px 0px 0px";
      removeButton.style.borderRadius = "3px";
      removeButton.innerHTML = "X";
      removeButton.style.fontSize = "1.0em";
      removeButton.style.width = "16px";
      removeButton.style.height = "16px";
      removeButton.style.marginLeft = "3px";
      removeButton.addEventListener("click", () => removeGeometryLayer(layerObj.filename));
      liObj.appendChild(removeButton);

      geolist.appendChild(liObj);
    }

    requestAnimationFrame(() => {
      let spanObj = liObj.querySelector("span");
      if (features.length === 0) {
        spanObj.innerHTML = "No features loaded :(";
        spanObj.style.color = "red";
        if (WME_Geometry) {
          WME_Geometry.destroy();
        }
      } else {
        spanObj.innerHTML = layerObj.filename;
        spanObj.title = `${layerObj.fileext.toUpperCase()} ${parser.externalProjection.projCode}: ${features.length} features loaded\n${labelwith}`;
        console.info(`WME Geometries: Loaded ${layerObj.filename}.${layerObj.fileext.toUpperCase()} ${parser.externalProjection.projCode}: ${features.length} features loaded\n${labelwith}`);
      }
    });
  }

  function removeGeometryLayer(filename) {
    const layerName = "Geometry: " + filename;

    // Get layers in the W.map marked with the "wme_geometry" layerGroup
    let layers = W.map.getLayersBy("layerGroup", "wme_geometry");
    let layerToDestroy = layers.find((layer) => layer.name === layerName);

    if (layerToDestroy) {
      // Destroy the layer
      layerToDestroy.destroy();

      // Remove from storedLayers
      storedLayers = storedLayers.filter((obj) => obj.filename !== filename);

      // Store the current local storage size and current layer array length
      let localStorageSize = localStorage.WMEGeoLayers ? localStorage.WMEGeoLayers.length / 1000 : 0;
      let layerindex = storedLayers.length;

      // If there are no more layers, remove the local storage item and set the layer array to an empty array
      if (layerindex === 0) {
        localStorage.removeItem("WMEGeoLayers");
        storedLayers = [];
      } else {
        // Otherwise, compress the remaining layers in the array and store it into local storage
        localStorage.WMEGeoLayers = LZString.compress(JSON.stringify(storedLayers));
      }
      // Calculate the new local storage size and the change in size
      let newLocalStorageSize = localStorage.WMEGeoLayers ? localStorage.WMEGeoLayers.length / 1000 : 0;
      let sizeChange = newLocalStorageSize - localStorageSize;

      console.info(`WME Geometries: Removed 1 file (${filename}). Storage size changed by ${sizeChange}kB. Total size is now ${newLocalStorageSize}kB`);

      // Remove the corresponding list item from the HTML
      let li = document.querySelector(`#${filename.replace(/[^a-z0-9_-]/gi, "_")}`);
      if (li) {
        li.remove();
      }
    }
  }

  function loadOLScript(filename, callback) {
    var version = OpenLayers.VERSION_NUMBER.replace(/Release /, "");
    console.info("WME Geometries: Loading openlayers/" + version + "/" + filename + ".js"); // https://cdnjs.com/libraries/openlayers/x.y.z/

    var openlayers = document.createElement("script");
    openlayers.src = "https://cdnjs.cloudflare.com/ajax/libs/openlayers/" + version + "/" + filename + ".js";
    openlayers.type = "text/javascript";
    openlayers.onload = callback;
    document.head.appendChild(openlayers);
  }
  
  function patchOpenLayers() {
    console.group("WME Geometries: Patching missing features..."); // replace missing functions in OpenLayers 2.13.1
    if (!OpenLayers.VERSION_NUMBER.match(/^Release [0-9.]*$/)) {
      console.error("WME Geometries: OpenLayers version mismatch (" + OpenLayers.VERSION_NUMBER + ") - cannot apply patch"); 
      return;
    }
    loadOLScript("lib/OpenLayers/Format/KML", function () {
      formats.KML = new OpenLayers.Format.KML();
      formathelp += ", KML";
    });
    loadOLScript("lib/OpenLayers/Format/GPX", function () {
      formats.GPX = new OpenLayers.Format.GPX();
      formathelp += ", GPX";
    });
    loadOLScript("lib/OpenLayers/Format/GML", function () {
      formats.GML = new OpenLayers.Format.GML();
      formathelp += ", GML";
    });
    console.groupEnd();
  }
  // Initialize your script
  if (W?.userscripts?.state.isInitialized) {
    init();
  } else {
    document.addEventListener("wme-initialized", init, { once: true });
  }
};
geometries();
