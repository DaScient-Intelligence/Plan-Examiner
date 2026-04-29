/**
 * Plan-Examiner Document Extractors
 * Parses uploaded DOCX, PDF, DXF, and DWG files to extract
 * structured "facts" used by the rule engine.
 *
 * All parsing happens client-side — no data leaves the browser.
 */

var PE = window.PE || {};

PE.Extractors = (function () {
  'use strict';

  // ── Regex helpers ────────────────────────────────────────────────────────

  var RE = {
    area:          /(?:gross\s*(?:floor)?\s*area|total\s*area|floor\s*area)[:\s=]+([0-9,]+(?:\.[0-9]+)?)\s*(?:sq\.?\s*ft|sf|sqft)/i,
    occupantLoad:  /(?:occupant\s*load|occupancy\s*load|calculated\s*load)[:\s=]+([0-9,]+)/i,
    stories:       /(?:number\s*of\s*(?:stories|floors?)|stories|floors?)[:\s=]+([0-9]+)/i,
    buildingHeight:/(?:building\s*height|height\s*above\s*grade)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:ft|feet|')/i,
    corridorWidth: /(?:corridor\s*width|hallway\s*width|aisle\s*width)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|")/i,
    doorWidth:     /(?:door\s*(?:clear\s*)?width|clear\s*door\s*width)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|")/i,
    stairTread:    /(?:stair\s*tread|tread\s*depth)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|")/i,
    stairRiser:    /(?:stair\s*riser|riser\s*height)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|")/i,
    stairWidth:    /(?:stair\s*width|stairway\s*width)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|")/i,
    adaTurning:    /(?:ada\s*turning|turning\s*(?:radius|diameter|space))[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|")/i,
    rampSlope:     /(?:ramp\s*slope|running\s*slope)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:%|:1|\/1)/i,
    fireSep:       /(?:fire\s*separation\s*distance|separation\s*distance)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:ft|feet|')/i,
    travelDist:    /(?:travel\s*distance|max\s*travel)[:\s=]+([0-9]+(?:\.[0-9]+)?)\s*(?:ft|feet|')/i,
    parking:       /(?:total\s*parking|parking\s*spaces?)[:\s=]+([0-9]+)/i,
    accessParking: /(?:accessible\s*parking|handicap(?:ped)?\s*parking)[:\s=]+([0-9]+)/i,
    occupancyGroup:/(?:occupancy\s*(?:group|class(?:ification)?)|use\s*group)[:\s=]+([A-Z][\w-]*)/i,
    sprinklers:    /(?:fire\s*sprinkler|auto(?:matic)?\s*sprinkler|nfpa\s*13)/i,
    noSprinklers:  /(?:no\s*(?:fire\s*)?sprinkler|un[-\s]?sprinkler)/i,
    fireAlarm:     /(?:fire\s*alarm|nfpa\s*72|smoke\s*detect)/i,
    exitSigns:     /(?:exit\s*sign|egress\s*sign)/i,
    emergencyLight:/(?:emergency\s*(?:egress\s*)?light|battery[- ]?backup\s*light)/i,
    handrail:      /(?:handrail|guard\s*rail|grabb?ing\s*bar)/i
  };

  function parse(text) {
    var f = {};
    var m;

    if ((m = RE.area.exec(text)))          f.grossArea            = parseFloat(m[1].replace(/,/g, ''));
    if ((m = RE.occupantLoad.exec(text)))  f.occupantLoad         = parseInt(m[1].replace(/,/g, ''), 10);
    if ((m = RE.stories.exec(text)))       f.stories              = parseInt(m[1], 10);
    if ((m = RE.buildingHeight.exec(text)))f.buildingHeightFt     = parseFloat(m[1]);
    if ((m = RE.corridorWidth.exec(text))) f.corridorWidthInches  = parseFloat(m[1]);
    if ((m = RE.doorWidth.exec(text)))     f.doorWidthInches      = parseFloat(m[1]);
    if ((m = RE.stairTread.exec(text)))    f.stairTreadDepthIn    = parseFloat(m[1]);
    if ((m = RE.stairRiser.exec(text)))    f.stairRiserHeightIn   = parseFloat(m[1]);
    if ((m = RE.stairWidth.exec(text)))    f.stairWidthInches     = parseFloat(m[1]);
    if ((m = RE.adaTurning.exec(text)))    f.adaTurningRadiusIn   = parseFloat(m[1]);
    if ((m = RE.fireSep.exec(text)))       f.fireSeparationDistanceFt = parseFloat(m[1]);
    if ((m = RE.travelDist.exec(text)))    f.travelDistanceFt     = parseFloat(m[1]);
    if ((m = RE.parking.exec(text)))       f.totalParkingSpaces   = parseInt(m[1], 10);
    if ((m = RE.accessParking.exec(text))) f.accessibleParkingSpaces = parseInt(m[1], 10);
    if ((m = RE.occupancyGroup.exec(text)))f.occupancyGroup       = m[1];
    if ((m = RE.rampSlope.exec(text))) {
      var s = parseFloat(m[1]);
      f.rampSlope = s > 1 ? s / 100 : s; // normalize % to fraction
    }

    // Boolean presence flags
    f.hasSprinklers       = RE.sprinklers.test(text)      ? true  : RE.noSprinklers.test(text) ? false : null;
    f.hasFireAlarm        = RE.fireAlarm.test(text)       ? true  : null;
    f.hasExitSigns        = RE.exitSigns.test(text)       ? true  : null;
    f.hasEmergencyLighting= RE.emergencyLight.test(text)  ? true  : null;
    f.hasHandrails        = RE.handrail.test(text)        ? true  : null;

    return f;
  }

  // ── DOCX extraction ────────────────────────────────────────────────────
  async function fromDocx(arrayBuffer) {
    if (typeof mammoth === 'undefined') throw new Error('mammoth.js not loaded');
    var result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    var text = result.value || '';
    return { text: text, facts: parse(text), source: 'docx' };
  }

  // ── PDF extraction (pdf.js) ────────────────────────────────────────────
  async function fromPdf(arrayBuffer) {
    if (!window.pdfjsLib) throw new Error('pdf.js not loaded');
    var pdf   = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    var pages = await Promise.all(
      Array.from({ length: pdf.numPages }, function (_, i) {
        return pdf.getPage(i + 1).then(function (page) {
          return page.getTextContent().then(function (content) {
            return content.items.map(function (item) { return item.str; }).join(' ');
          });
        });
      })
    );
    var text = pages.join('\n');
    return { text: text, facts: parse(text), source: 'pdf', pageCount: pdf.numPages };
  }

  // ── DXF extraction ────────────────────────────────────────────────────
  //  Minimal DXF parser: extracts TEXT/MTEXT content and LINE lengths from
  //  the ENTITIES section to infer dimensional facts.
  function fromDxf(text) {
    var facts = {};
    var extractedText = [];

    // Extract TEXT entities
    var textRe = /\s0\s*\n\s*TEXT[\s\S]*?^\s*1\s*\n\s*(.+)/gm;
    var mtextRe = /\s0\s*\n\s*MTEXT[\s\S]*?^\s*1\s*\n\s*(.+)/gm;
    var m;
    while ((m = textRe.exec(text)) !== null)  extractedText.push(m[1].trim());
    while ((m = mtextRe.exec(text)) !== null) extractedText.push(m[1].replace(/\\P/g, ' ').replace(/[{}\\][^;]*;/g, '').trim());

    // Extract layer names to infer features
    var layers = [];
    var layerRe = /^\s*8\s*\n\s*([^\r\n]+)/gm;
    while ((m = layerRe.exec(text)) !== null) layers.push(m[1].trim().toUpperCase());
    var layerSet = layers.filter(function (v, i, a) { return a.indexOf(v) === i; });

    var combined = extractedText.join(' ');
    var parsedFacts = parse(combined);
    Object.assign(facts, parsedFacts);

    // Layer-name heuristics
    var layerStr = layerSet.join(' ');
    if (/SPRINKLER|FIRE.*SUPP/.test(layerStr)) facts.hasSprinklers = true;
    if (/ALARM|DETECT/.test(layerStr))         facts.hasFireAlarm  = true;
    if (/EXIT.*SIGN|EGRESS.*SIGN/.test(layerStr)) facts.hasExitSigns = true;
    if (/EMERG.*LIGHT|BATTERY.*LIGHT/.test(layerStr)) facts.hasEmergencyLighting = true;
    if (/HANDRAIL|GUARDRAIL/.test(layerStr))   facts.hasHandrails  = true;
    if (/RAMP/.test(layerStr))                 facts._hasRampLayer = true;
    if (/STAIR/.test(layerStr))                facts._hasStairLayer = true;
    if (/PARK/.test(layerStr))                 facts._hasParkingLayer = true;

    // Extract LINE entity lengths
    var lines = [];
    var lineRe = /\s0\s*\n\s*LINE\s*\n[\s\S]*?^\s*10\s*\n\s*([\d.+-]+)[\s\S]*?^\s*20\s*\n\s*([\d.+-]+)[\s\S]*?^\s*11\s*\n\s*([\d.+-]+)[\s\S]*?^\s*21\s*\n\s*([\d.+-]+)/gm;
    while ((m = lineRe.exec(text)) !== null) {
      var x1 = parseFloat(m[1]), y1 = parseFloat(m[2]);
      var x2 = parseFloat(m[3]), y2 = parseFloat(m[4]);
      var len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      lines.push(len);
    }

    // Heuristic: short horizontal/vertical lines near 32-48 range could be door openings (assume inches)
    if (lines.length) {
      var doorCandidates = lines.filter(function (l) { return l >= 28 && l <= 72; });
      if (doorCandidates.length && !facts.doorWidthInches) {
        facts.doorWidthInches = Math.round(doorCandidates.reduce(function (a, b) { return a + b; }, 0) / doorCandidates.length);
      }
      var corrCandidates = lines.filter(function (l) { return l >= 36 && l <= 144; });
      if (corrCandidates.length && !facts.corridorWidthInches) {
        facts.corridorWidthInches = Math.round(corrCandidates.reduce(function (a, b) { return a + b; }, 0) / corrCandidates.length);
      }
    }

    return {
      text:        combined,
      facts:       facts,
      source:      'dxf',
      layers:      layerSet,
      lineCount:   lines.length,
      textEntities: extractedText.length
    };
  }

  // ── Image / OCR (Tesseract.js, lazy-loaded) ──────────────────────────
  async function fromImage(file) {
    if (!window.Tesseract) {
      // Lazy-load Tesseract
      await new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    var worker = await Tesseract.createWorker('eng');
    var url    = URL.createObjectURL(file);
    var result = await worker.recognize(url);
    await worker.terminate();
    URL.revokeObjectURL(url);
    var text = result.data.text || '';
    return { text: text, facts: parse(text), source: 'image' };
  }

  // ── Merge form data into facts ──────────────────────────────────────
  function mergeFormData(facts, formData) {
    var merged = Object.assign({}, facts);
    if (formData.buildingType)  merged.buildingType  = formData.buildingType;
    if (formData.buildingCode)  merged.buildingCode  = formData.buildingCode;
    if (formData.city)          merged.city          = formData.city;
    if (formData.state)         merged.state         = formData.state;
    if (formData.country)       merged.country       = formData.country;
    if (formData.occupantLoad && !merged.occupantLoad)  merged.occupantLoad  = parseInt(formData.occupantLoad, 10);
    if (formData.grossArea && !merged.grossArea)        merged.grossArea     = parseFloat(formData.grossArea);
    return merged;
  }

  // ── Main entry point ─────────────────────────────────────────────────
  async function extract(file, formData) {
    var name = file.name.toLowerCase();
    var buf  = await file.arrayBuffer();
    var raw;

    if (name.endsWith('.docx'))                      raw = await fromDocx(buf);
    else if (name.endsWith('.pdf'))                  raw = await fromPdf(buf);
    else if (name.endsWith('.dxf'))                  raw = fromDxf(new TextDecoder().decode(buf));
    else if (name.endsWith('.dwg'))                  raw = { text: '', facts: {}, source: 'dwg', unsupported: true };
    else if (/\.(png|jpe?g|tiff?|bmp|webp)$/.test(name)) raw = await fromImage(file);
    else                                             raw = { text: '', facts: {}, source: 'unknown' };

    raw.facts = mergeFormData(raw.facts, formData || {});
    return raw;
  }

  return { extract: extract, fromDxf: fromDxf, parse: parse };

}());

window.PE = PE;
