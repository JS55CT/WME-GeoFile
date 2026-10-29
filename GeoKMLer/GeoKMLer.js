// ==UserScript==
// @name                GeoKMLer
// @namespace           https://github.com/JS55CT
// @description         geoKMLer is a JavaScript library designed to convert KML data into GeoJSON format efficiently. It supports conversion of Placemarks containing Point, LineString, Polygon, and MultiGeometry elements.
// @version             3.0.0
// @author              JS55CT
// @license             MIT
// @match              *://this-library-is-not-supposed-to-run.com/*
// ==/UserScript==

/***********************************************************
 * ## Project Home < https://github.com/JS55CT/GeoKMLer >
 *  MIT License
 * Copyright (c) 2025 JS55CT
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 **************************************************************/
var GeoKMLer = (function () {
  /**
   * GeoKMLer constructor function.
   * @param {Object} obj - Optional object to wrap.
   * @returns {GeoKMLer} - An instance of GeoKMLer.
   */
  function GeoKMLer(obj) {
    if (obj instanceof GeoKMLer) return obj;
    if (!(this instanceof GeoKMLer)) return new GeoKMLer(obj);
    this._wrapped = obj;
  }

  //geometry elements a Placemark can hold; a Placemark with none of these is warned about
  const GEOMETRY_TAGS = ["Point", "LineString", "LinearRing", "Polygon", "MultiGeometry"];

  //DOM parser used by read(). Defaults to the browser's; in Node, set GeoKMLer.DOMParser to a shim such as @xmldom/xmldom.
  GeoKMLer.DOMParser = typeof DOMParser !== "undefined" ? DOMParser : null;

  /**
   * Parses a KML string into an XML DOM.
   * @param {string} kmlText - The KML text to parse.
   * @returns {Document} - The parsed XML document.
   */
  GeoKMLer.prototype.read = function (kmlText) {
    if (!GeoKMLer.DOMParser) throw new Error("No DOMParser available. In Node, set GeoKMLer.DOMParser to a DOM shim.");
    const parser = new GeoKMLer.DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, "application/xml");

    // Check for parsing errors by looking for parser error tags
    const parseErrors = xmlDoc.getElementsByTagName("parsererror");
    if (parseErrors.length > 0) {
      // If there are parsing errors, log them and throw an error
      const errorMessages = Array.from(parseErrors)
        .map((errorElement, index) => {
          return `Parsing Error ${index + 1}: ${errorElement.textContent}`;
        })
        .join("\n");

      console.error(errorMessages);

      // Throw an error to indicate parsing failure
      throw new Error("Failed to parse KML. See console for details.");
    }

    // If parsing is successful, return the parsed XML document
    return xmlDoc;
  };

  /**
   * Converts a KML document to a GeoJSON FeatureCollection.
   * @param {Document} kmlDoc - The KML document to convert.
   * @param {boolean} includeCrs - Optional boolean to determine if CRS should be included.
   * @param {boolean} dropElevation - Optional boolean to drop the third (elevation) value from every position.
   * @param {boolean|string} style - Optional style output: false (none), "simplestyle" (simplestyle-spec names),
   *   or "openlayers" (OpenLayers FeatureStyle names). Any other value throws.
   * @param {boolean} castTypes - Optional boolean to convert SchemaData values to their SimpleField types (int, double, bool).
   *   Values that do not convert exactly stay strings.
   * @param {boolean} rfc7946Winding - Optional boolean to orient polygon rings per RFC 7946: exterior rings
   *   counter-clockwise, holes clockwise. Off by default, so the KML ring order is kept.
   * @returns {Object} - The resulting GeoJSON FeatureCollection.
   *
   * NOTE:
   * KML files inherently assume the use of the EPSG:4326 (WGS 84) coordinate reference system
   * for all geographic coordinates. As such, when converting from KML to GeoJSON, the coordinates
   * are retained in the standard WGS 84 format.
   *
   * The GeoJSON output will conform to this CRS standard, and no additional CRS transformation are needed.
   * Users can rely on the spatial information being accurate with respect to the WGS 84 datum.
   *
   * Additionally, this function includes an option to add CRS information explicitly to the GeoJSON output (none standard).
   * By setting the `includeCrs` parameter to `true`, the resulting GeoJSON will include a 'crs' property
   * that specifies the use of EPSG:4326:  the geoJSON standard.
   *
   * crs: {
   *   type: "name",
   *   properties: {
   *     name: "EPSG:4326",
   *   },
   * }
   */
  GeoKMLer.prototype.toGeoJSON = function (kmlDoc, includeCrs = false, dropElevation = false, style = false, castTypes = false, rfc7946Winding = false) {
    if (style !== false && !["simplestyle", "openlayers"].includes(style))
      throw new Error(`Unknown style format "${style}". Use false, "simplestyle", or "openlayers".`);

    const styleIndex = style === false ? null : this.indexStyles(kmlDoc);
    const features = [];
    for (const placemark of kmlDoc.getElementsByTagNameNS("*", "Placemark")) {
      for (const feature of this.handlePlacemark(placemark, castTypes)) {
        if (style !== false)
          Object.assign(feature.properties, this.styleProperties(this.resolveStyle(placemark, styleIndex), style));
        features.push(feature);
      }
    }

    if (dropElevation) {
      for (const feature of features) feature.geometry.coordinates = this.stripElevation(feature.geometry.coordinates);
    }

    if (rfc7946Winding) {
      for (const feature of features)
        if (feature.geometry.type === "Polygon") feature.geometry.coordinates = this.applyRightHandRule(feature.geometry.coordinates);
    }

    const geoJson = {
      type: "FeatureCollection",
      features: features,
    };

    if (includeCrs) {
      geoJson.crs = {
        type: "name",
        properties: {
          name: "EPSG:4326",
        },
      };
    }

    return geoJson;
  };

  /**
   * Drops the elevation value from every position, recursing until it reaches a position.
   * @param {Array} coordinates - Nested coordinate arrays.
   * @returns {Array} - The same nesting with each position reduced to [lon, lat].
   */
  GeoKMLer.prototype.stripElevation = function (coordinates) {
    if (Array.isArray(coordinates[0])) return coordinates.map((c) => this.stripElevation(c));
    return coordinates.slice(0, 2);
  };

  /**
   * Signed area of a closed ring (shoelace formula). Positive when the ring runs counter-clockwise.
   * @param {Array} ring - Closed ring of [lon, lat] positions.
   * @returns {number} - The signed area in squared degrees.
   */
  GeoKMLer.prototype.signedArea = function (ring) {
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    return sum / 2;
  };

  /**
   * Orients polygon rings per RFC 7946: the first ring (exterior) counter-clockwise, the rest (holes) clockwise.
   * @param {Array} rings - The polygon's rings.
   * @returns {Array} - The rings, reversed where needed.
   */
  GeoKMLer.prototype.applyRightHandRule = function (rings) {
    return rings.map((ring, i) => {
      const isCcw = this.signedArea(ring) > 0;
      return isCcw === (i === 0) ? ring : [...ring].reverse();
    });
  };

  /**
   * Converts a KML aabbggrr color into a #rrggbb hex color and an opacity.
   * @param {string} kmlColor - The KML color string.
   * @returns {Object|null} - { hex, opacity }, or null when no color is given.
   */
  GeoKMLer.prototype.parseColor = function (kmlColor) {
    if (!kmlColor) return null;
    const c = kmlColor.trim();
    const [a, b, g, r] = [0, 2, 4, 6].map((i) => c.substr(i, 2));
    return { hex: `#${r}${g}${b}`, opacity: parseInt(a, 16) / 255 };
  };

  /**
   * Indexes every Style and StyleMap in the document by its id.
   * @param {Document} document - The KML document.
   * @returns {Object} - Map of id to Style or StyleMap element.
   */
  GeoKMLer.prototype.indexStyles = function (document) {
    const index = Object.create(null);
    for (const el of [...document.getElementsByTagNameNS("*", "Style"), ...document.getElementsByTagNameNS("*", "StyleMap")]) {
      const id = el.getAttribute("id");
      if (id) index[id] = el;
    }
    return index;
  };

  /**
   * Finds the Style that applies to a Placemark: an inline Style, or a styleUrl resolved against the index.
   * A StyleMap resolves through its "normal" pair. External style files (file.kml#id) are not supported.
   * @param {Element} placemark - The Placemark element.
   * @param {Object} index - The index built by indexStyles.
   * @returns {Element|null} - The Style element, or null if none applies.
   */
  GeoKMLer.prototype.resolveStyle = function (placemark, index) {
    const inline = Array.from(placemark.children).find((n) => n.localName === "Style");
    if (inline) return inline;

    const lookup = (el) => index[this.nodeVal(this.getChildNode(el, "styleUrl")).trim().replace(/^#/, "")];
    let style = lookup(placemark);
    if (style && style.localName === "StyleMap") {
      const normal = this.getChildNodes(style, "Pair").find((p) => this.nodeVal(this.getChildNode(p, "key")).trim() === "normal");
      style = normal ? lookup(normal) : null;
    }
    return style || null;
  };

  /**
   * Reads every supported KML style property into one neutral object, independent of output format.
   * Colors are { hex, opacity } or null; numbers are NaN when absent.
   * @param {Element} styleEl - The Style element.
   * @returns {Object} - The neutral style values.
   */
  GeoKMLer.prototype.readStyle = function (styleEl) {
    const child = (el, tag) => (el ? this.getChildNode(el, tag) : null);
    const text = (el, tag) => {
      const n = child(el, tag);
      return n ? n.textContent.trim() : null;
    };
    const lineStyle = child(styleEl, "LineStyle");
    const polyStyle = child(styleEl, "PolyStyle");
    const iconStyle = child(styleEl, "IconStyle");
    const labelStyle = child(styleEl, "LabelStyle");
    const balloonStyle = child(styleEl, "BalloonStyle");
    return {
      line: this.parseColor(text(lineStyle, "color")),
      lineWidth: parseFloat(text(lineStyle, "width")),
      outerColor: this.parseColor(text(lineStyle, "outerColor")),
      outerWidth: parseFloat(text(lineStyle, "outerWidth")),
      poly: this.parseColor(text(polyStyle, "color")),
      fillOn: text(polyStyle, "fill") !== "0",
      outlineOn: text(polyStyle, "outline") !== "0",
      icon: this.parseColor(text(iconStyle, "color")),
      iconScale: parseFloat(text(iconStyle, "scale")),
      heading: parseFloat(text(iconStyle, "heading")),
      href: text(child(iconStyle, "Icon"), "href"),
      labelColor: this.parseColor(text(labelStyle, "color")),
      labelScale: parseFloat(text(labelStyle, "scale")),
      balloonBg: this.parseColor(text(balloonStyle, "bgColor")),
      balloonText: this.parseColor(text(balloonStyle, "textColor")),
    };
  };

  /**
   * Maps neutral style values to simplestyle-spec property names.
   * Names outside the spec (icon, rotation, label-*, outer-*, balloon-*) are custom properties.
   * @param {Object} s - The neutral style values from readStyle.
   * @returns {Object} - simplestyle properties.
   */
  GeoKMLer.prototype.toSimplestyle = function (s) {
    const p = {};
    if (s.line) Object.assign(p, { stroke: s.line.hex, "stroke-opacity": s.line.opacity });
    if (s.poly) Object.assign(p, { fill: s.poly.hex, "fill-opacity": s.poly.opacity });
    if (s.icon) p["marker-color"] = s.icon.hex; //alpha dropped: simplestyle has no marker opacity
    if (!Number.isNaN(s.lineWidth)) p["stroke-width"] = s.lineWidth;
    //simplestyle has no pixel sizes for markers, so the KML scale is bucketed
    if (!Number.isNaN(s.iconScale)) p["marker-size"] = s.iconScale < 0.75 ? "small" : s.iconScale > 1.25 ? "large" : "medium";
    if (!Number.isNaN(s.heading)) p.rotation = s.heading;
    if (s.href) p.icon = s.href;
    if (s.labelColor) p["label-color"] = s.labelColor.hex;
    if (!Number.isNaN(s.labelScale)) p["label-scale"] = s.labelScale;
    if (s.outerColor) p["outer-color"] = s.outerColor.hex;
    if (!Number.isNaN(s.outerWidth)) p["outer-width"] = s.outerWidth;
    if (s.balloonBg) p["balloon-bg-color"] = s.balloonBg.hex;
    if (s.balloonText) p["balloon-text-color"] = s.balloonText.hex;
    if (!s.fillOn) p["fill-opacity"] = 0;
    if (!s.outlineOn) p["stroke-opacity"] = 0;
    return p;
  };

  /**
   * Maps neutral style values to OpenLayers FeatureStyle-style property names.
   * @param {Object} s - The neutral style values from readStyle.
   * @returns {Object} - OpenLayers properties.
   */
  GeoKMLer.prototype.toOpenLayers = function (s) {
    const p = {};
    if (s.line) Object.assign(p, { strokeColor: s.line.hex, strokeOpacity: s.line.opacity });
    if (s.poly) Object.assign(p, { fillColor: s.poly.hex, fillOpacity: s.poly.opacity });
    else if (s.icon) Object.assign(p, { fillColor: s.icon.hex, fillOpacity: s.icon.opacity }); //icon color fills point features
    if (!Number.isNaN(s.lineWidth)) p.strokeWidth = s.lineWidth;
    //KML icon scale 1 maps to an 8px point radius, and label scale 1 to 16px (assumed bases, not from the KML)
    if (!Number.isNaN(s.iconScale)) p.pointRadius = s.iconScale * 8;
    if (!Number.isNaN(s.heading)) p.rotation = s.heading;
    if (s.href) p.icon = s.href;
    if (s.labelColor) p.fontColor = s.labelColor.hex;
    if (!Number.isNaN(s.labelScale)) p.fontSize = s.labelScale * 16;
    if (s.outerColor) p.outerColor = s.outerColor.hex;
    if (!Number.isNaN(s.outerWidth)) p.outerWidth = s.outerWidth;
    if (s.balloonBg) p.balloonBgColor = s.balloonBg.hex;
    if (s.balloonText) p.balloonTextColor = s.balloonText.hex;
    if (!s.fillOn) p.fillOpacity = 0;
    if (!s.outlineOn) p.strokeOpacity = 0;
    return p;
  };

  /**
   * Builds the style properties for a feature in the requested format.
   *
   * Mapping (KML -> output). Colors convert from aabbggrr to #rrggbb, with alpha as the opacity.
   *
   * | KML                           | simplestyle                | openlayers                          | Notes |
   * |-------------------------------|----------------------------|-------------------------------------|-------|
   * | LineStyle/color               | stroke, stroke-opacity     | strokeColor, strokeOpacity          | |
   * | LineStyle/width               | stroke-width               | strokeWidth                         | pixels |
   * | LineStyle/gx:outerColor       | outer-color                | outerColor                          | custom, Google extension |
   * | LineStyle/gx:outerWidth       | outer-width                | outerWidth                          | custom, Google extension |
   * | PolyStyle/color               | fill, fill-opacity         | fillColor, fillOpacity              | |
   * | PolyStyle/fill = 0            | fill-opacity = 0          | fillOpacity = 0                     | |
   * | PolyStyle/outline = 0         | stroke-opacity = 0        | strokeOpacity = 0                   | |
   * | IconStyle/color               | marker-color               | fillColor (only if no PolyStyle)    | alpha dropped in simplestyle |
   * | IconStyle/scale               | marker-size                | pointRadius = scale × 8             | simplestyle: below 0.75 small, above 1.25 large |
   * | IconStyle/heading             | rotation                   | rotation                            | degrees, custom |
   * | IconStyle/Icon/href           | icon                       | icon                                | custom |
   * | LabelStyle/color              | label-color                | fontColor                           | custom |
   * | LabelStyle/scale              | label-scale                | fontSize = scale × 16               | custom |
   * | BalloonStyle/bgColor          | balloon-bg-color           | balloonBgColor                      | custom, popup only |
   * | BalloonStyle/textColor        | balloon-text-color         | balloonTextColor                    | custom, popup only |
   *
   * Not converted: IconStyle/hotSpot (anchor point, no simplestyle equivalent), ListStyle (Places panel only),
   * colorMode="random", gx:physicalWidth, gx:labelVisibility, BalloonStyle/text, BalloonStyle/displayMode.
   *
   * @param {Element|null} styleEl - The Style element that applies to the feature.
   * @param {string} format - "simplestyle" or "openlayers".
   * @returns {Object} - The style properties (empty when there is no style).
   */
  GeoKMLer.prototype.styleProperties = function (styleEl, format) {
    if (!styleEl) return {};
    const s = this.readStyle(styleEl);
    return format === "simplestyle" ? this.toSimplestyle(s) : this.toOpenLayers(s);
  };

  /**
   * Processes a KML Placemark and converts its geometries to GeoJSON features.
   * @param {Element} placemark - The Placemark element to process.
   * @returns {Array} - An array of GeoJSON features.
   */
  GeoKMLer.prototype.handlePlacemark = function (placemark, castTypes = false) {
    const properties = this.extractProperties(placemark);
    // Merge extended data directly into the properties without an additional 'ExtendedData' entry
    Object.assign(properties, this.extractExtendedData(placemark, castTypes));

    const features = Array.from(placemark.children)
      .flatMap((element) => this.geometryToFeatures(element, placemark, properties))
      .filter(Boolean); //skipped geometries come back as null
    if (features.length === 0 && !Array.from(placemark.children).some((el) => GEOMETRY_TAGS.includes(el.localName)))
      console.warn(`GeoKMLer: Placemark "${this.placemarkName(placemark)}" has no supported geometry and was skipped.`);
    return features;
  };

  /**
   * Converts one geometry element to GeoJSON features, recursing into MultiGeometry.
   * Elements that are not geometries (name, description, ...) produce no features.
   * @param {Element} element - A Point, LineString, Polygon, or MultiGeometry element.
   * @param {Element} placemark - The parent Placemark element.
   * @param {Object} props - The properties of the features.
   * @returns {Array} - An array of GeoJSON features (may contain null for skipped geometries).
   */
  GeoKMLer.prototype.geometryToFeatures = function (element, placemark, props) {
    switch (element.localName) {
      case "Point":
        return [this.pointToPoint(element, placemark, props)];
      case "LineString":
        return [this.lineStringToLineString(element, placemark, props)];
      case "Polygon":
        return [this.polygonToPolygon(element, placemark, props)];
      case "LinearRing": {
        //a standalone ring is a polygon with one boundary
        const ring = this.closeRing(this.coordinatesOf(element));
        return [ring.length >= 4 ? this.makeFeature("Polygon", [ring], props) : this.skip(placemark, "LinearRing needs at least 4 valid positions")];
      }
      case "MultiGeometry":
        return Array.from(element.children).flatMap((child) => this.geometryToFeatures(child, placemark, props));
      default:
        return [];
    }
  };

  /**
   * Converts coordinate strings into arrays of [longitude, latitude].
   * @param {string} coordString - The coordinate string from KML.
   * @returns {Array} - An array of [longitude, latitude] pairs.
   */
  GeoKMLer.prototype.coordFromString = function (coordString) {
    //positions that are not finite numbers or fall outside the WGS 84 range are dropped
    return coordString.trim().split(/\s+/).map((coord) => {
        const [lon, lat, ele] = coord.split(",").map(parseFloat);
        return Number.isFinite(ele) ? [lon, lat, ele] : [lon, lat];
      })
      .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90);
  };

  //Schema field types per document, cached so each Placemark does not rescan the file
  const schemaCache = new WeakMap();

  /**
   * Maps each Schema id to its SimpleField types, e.g. { schemaId: { fieldName: "int" } }.
   * @param {Document} kmlDoc - The KML document.
   * @returns {Object} - The schema types for the document.
   */
  GeoKMLer.prototype.schemaTypes = function (kmlDoc) {
    if (!schemaCache.has(kmlDoc)) {
      const types = {};
      for (const schema of this.getChildNodes(kmlDoc, "Schema")) {
        const fields = {};
        for (const field of this.getChildNodes(schema, "SimpleField"))
          fields[field.getAttribute("name")] = (field.getAttribute("type") || "string").toLowerCase();
        types[schema.getAttribute("id")] = fields;
      }
      schemaCache.set(kmlDoc, types);
    }
    return schemaCache.get(kmlDoc);
  };

  /**
   * Converts a SimpleData value to its schema type. A value converts only when the result is exact,
   * so "007" (leading zero) and "1,5" (comma decimal) stay strings rather than losing information.
   * @param {string} text - The trimmed value.
   * @param {string} type - The SimpleField type (int, double, bool, ...).
   * @returns {string|number|boolean} - The converted value, or the original text.
   */
  GeoKMLer.prototype.castValue = function (text, type) {
    if (type === "bool") {
      if (/^(true|1)$/i.test(text)) return true;
      if (/^(false|0)$/i.test(text)) return false;
      return text;
    }
    if (["int", "uint", "short", "ushort", "long", "ulong", "byte", "ubyte"].includes(type)) {
      const n = parseInt(text, 10);
      return /^[+-]?\d+$/.test(text) && String(n) === text.replace(/^\+/, "") ? n : text;
    }
    if (["float", "double", "decimal"].includes(type))
      return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text) ? parseFloat(text) : text;
    return text;
  };

  /**
   * Extracts extended data from a KML placemark.
   * @param {Element} placemark - The Placemark element to extract from.
   * @param {boolean} castTypes - Optional boolean to convert SchemaData values using their SimpleField types.
   * @returns {Object} - An object containing extended data properties.
   */
  GeoKMLer.prototype.extractExtendedData = function (placemark, castTypes = false) {
    const extendedData = {};
    const extendedDataTag = this.getChildNode(placemark, "ExtendedData");
    if (!extendedDataTag) return extendedData;

    const types = castTypes ? this.schemaTypes(placemark.ownerDocument) : null;

    //SimpleData holds its value as text; Google-style Data holds it in a <value> child
    const simpleDatas = this.getChildNodes(extendedDataTag, "SimpleData");
    simpleDatas.forEach((data) => {
      const name = data.getAttribute("name");
      const value = this.nodeVal(data);
      if (name && value !== null) {
        const schemaData = data.parentNode;
        const schemaId = schemaData && schemaData.localName === "SchemaData" ? (schemaData.getAttribute("schemaUrl") || "").replace(/^#/, "") : "";
        const type = types && types[schemaId] && types[schemaId][name];
        extendedData[`ex_${name}`] = type ? this.castValue(value.trim(), type) : value.trim();
      }
    });

    this.getChildNodes(extendedDataTag, "Data").forEach((data) => {
      const name = data.getAttribute("name");
      const value = this.getChildNode(data, "value");
      if (name && value) extendedData[`ex_${name}`] = value.textContent.trim();
    });

    return extendedData;
  };

  /**
   * Fetches the value of a text node.
   * @param {Node} x - The node to extract the value from.
   * @returns {string} - The text content of the node.
   */
  GeoKMLer.prototype.nodeVal = function (x) {
    return x ? x.textContent || "" : "";
  };

  /**
   * Retrieves a single child node of a specified tag name.
   * @param {Element} x - The parent element.
   * @param {string} y - The tag name of the child node.
   * @returns {Element|null} - The first matching child node or null if none are found.
   */
  GeoKMLer.prototype.getChildNode = function (x, y) {
    //matches the local name, so a namespace prefix (kml:Placemark) does not hide the element
    const nodeList = x.getElementsByTagNameNS("*", y);
    return nodeList.length ? nodeList[0] : null;
  };

  /**
   * Retrieves all child nodes of a specified tag name.
   * @param {Element} x - The parent element.
   * @param {string} y - The tag name of the child nodes.
   * @returns {Array} - An array of matching child nodes.
   */
  GeoKMLer.prototype.getChildNodes = function (x, y) {
    return Array.from(x.getElementsByTagNameNS("*", y));
  };

  /**
   * Creates a GeoJSON feature for a given geometry type and coordinates.
   * @param {string} type - The geometry type (Point, LineString, Polygon).
   * @param {Array} coords - The coordinates for the geometry.
   * @param {Object} props - The properties of the feature.
   * @returns {Object} - The created GeoJSON feature.
   */
  GeoKMLer.prototype.makeFeature = function (type, coords, props) {
    return {
      type: "Feature",
      geometry: {
        type: type,
        coordinates: coords,
      },
      properties: { ...props }, //copied so features from one Placemark never share an object
    };
  };

  /**
   * Reads and validates the coordinates of a geometry element.
   * @param {Element} node - An element with a coordinates child (Point, LineString, LinearRing).
   * @returns {Array} - Valid positions, or an empty array when there are none.
   */
  GeoKMLer.prototype.coordinatesOf = function (node) {
    const el = this.getChildNode(node, "coordinates");
    return el ? this.coordFromString(el.textContent) : [];
  };

  /**
   * Closes a linear ring by repeating its first position at the end, as GeoJSON requires.
   * @param {Array} ring - The ring positions.
   * @returns {Array} - The same ring, closed.
   */
  GeoKMLer.prototype.closeRing = function (ring) {
    if (ring.length === 0) return ring;
    const [first, last] = [ring[0], ring[ring.length - 1]];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
    return ring;
  };

  /**
   * Warns about a geometry that cannot be converted, so the rest of the file still converts.
   * @param {Element} placemark - The Placemark the geometry belongs to.
   * @param {string} reason - Why the geometry was skipped.
   * @returns {null} - Always null, so callers can return it directly.
   */
  GeoKMLer.prototype.skip = function (placemark, reason) {
    console.warn(`GeoKMLer: skipped a geometry in Placemark "${this.placemarkName(placemark)}": ${reason}`);
    return null;
  };

  /**
   * Returns the Placemark's name for use in warnings.
   * @param {Element} placemark - The Placemark element.
   * @returns {string} - The trimmed name, or "(unnamed)".
   */
  GeoKMLer.prototype.placemarkName = function (placemark) {
    const name = this.getChildNode(placemark, "name");
    return name && name.textContent.trim() ? name.textContent.trim() : "(unnamed)";
  };

  /**
   * Converts a KML Point to a GeoJSON Point feature.
   * @param {Element} node - The Point element.
   * @param {Element} placemark - The parent Placemark element.
   * @param {Object} props - The properties of the feature.
   * @returns {Object} - A GeoJSON Point feature.
   */
  GeoKMLer.prototype.pointToPoint = function (node, placemark, props) {
    //a KML Point holds one position, so only the first (and only) coordinate is used
    const [coord] = this.coordinatesOf(node);
    return coord ? this.makeFeature("Point", coord, props) : this.skip(placemark, "Point has no valid coordinates");
  };

  /**
   * Converts a KML LineString to a GeoJSON LineString feature.
   * @param {Element} node - The LineString element.
   * @param {Element} placemark - The parent Placemark element.
   * @param {Object} props - The properties of the feature.
   * @returns {Object} - A GeoJSON LineString feature.
   */
  GeoKMLer.prototype.lineStringToLineString = function (node, placemark, props) {
    const coords = this.coordinatesOf(node);
    return coords.length >= 2 ? this.makeFeature("LineString", coords, props) : this.skip(placemark, "LineString needs at least 2 valid positions");
  };

  /**
   * Converts a KML Polygon to a GeoJSON Polygon feature.
   * @param {Element} node - The Polygon element.
   * @param {Element} placemark - The parent Placemark element.
   * @param {Object} props - The properties of the feature.
   * @returns {Object} - A GeoJSON Polygon feature.
   */
  GeoKMLer.prototype.polygonToPolygon = function (node, placemark, props) {
    //each ring is closed, and a ring with fewer than 4 positions invalidates the whole polygon
    const rings = this.getChildNodes(node, "LinearRing").map((ring) => this.closeRing(this.coordinatesOf(ring)));
    if (!rings.length || rings.some((ring) => ring.length < 4))
      return this.skip(placemark, "Polygon has no valid LinearRing");
    return this.makeFeature("Polygon", rings, props);
  };

  /**
   * Extracts properties from a Placemark, excluding geometry elements.
   * @param {Element} placemark - The Placemark element to extract properties from.
   * @returns {Object} - An object containing placemark properties.
   */
  GeoKMLer.prototype.extractProperties = function (placemark) {
    const props = {};
    //deny-list of KML elements that are not feature properties; matched by local name so prefixed elements (gx:Track) are caught
    const skipped = ["Point", "LineString", "Polygon", "MultiGeometry", "LinearRing", "Style", "StyleMap", "styleUrl", "TimeSpan", "TimeStamp", "ExtendedData", "Region", "LookAt", "Camera", "Track", "MultiTrack"];
    for (const n of placemark.children) {
      if (!skipped.includes(n.localName)) props[n.localName] = n.textContent.trim();
    }
    return props;
  };

  return GeoKMLer;
})();

//CommonJS export for Node and bundlers; in the browser GeoKMLer is already a global
if (typeof module === "object" && module.exports) module.exports = GeoKMLer;
