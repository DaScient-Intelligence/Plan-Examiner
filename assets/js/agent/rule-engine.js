/**
 * Plan-Examiner Rule Engine
 * Evaluates extracted plan facts against loaded rule packs and returns
 * PASS / REVIEW / FLAGGED findings with citations and remediation text.
 *
 * All logic runs client-side — no data leaves the browser.
 */

var PE = window.PE || {};

PE.RuleEngine = (function () {
  'use strict';

  // ── Check function registry ─────────────────────────────────────────────
  var checks = {

    egress_width: function (facts, params) {
      var w = facts.corridorWidthInches || facts.egressWidthInches || 0;
      if (!w) return { status: 'REVIEW', note: 'Corridor/egress width not found in document — manual verification required.' };
      if (w < params.min_inches) return { status: 'FLAGGED', note: 'Egress width ' + w + ' in. is below minimum ' + params.min_inches + ' in.' };
      if (w < params.corridor_min_inches) return { status: 'REVIEW', note: 'Width ' + w + ' in. is adequate for basic egress but corridors require ' + params.corridor_min_inches + ' in.' };
      return { status: 'PASS', note: 'Egress/corridor width ' + w + ' in. meets §1005.1 minimum.' };
    },

    num_exits: function (facts, params) {
      var load = facts.occupantLoad || 0;
      var exits = facts.numExits || 0;
      var required = 1;
      if (load > 1000) required = 4;
      else if (load > 500) required = 3;
      else if (load >= 50) required = 2;
      if (!exits) return { status: 'REVIEW', note: 'Exit count not extracted — verify ' + required + ' exit(s) for occupant load ' + load + '.' };
      if (exits < required) return { status: 'FLAGGED', note: exits + ' exit(s) provided; ' + required + ' required for occupant load ' + load + '.' };
      return { status: 'PASS', note: exits + ' exit(s) provided; ' + required + ' required for occupant load ' + load + '.' };
    },

    occupant_load: function (facts, params) {
      var area = facts.grossArea || facts.floorArea || 0;
      var type = (facts.occupancyGroup || facts.buildingType || '').toLowerCase();
      if (!area) return { status: 'REVIEW', note: 'Floor area not found — cannot verify occupant load calculation.' };
      var factor = params.load_factors['business'] || 150;
      if (type.includes('assembly') || type.includes('restaurant') || type.includes('hall')) factor = params.load_factors['assembly_unconcentrated'];
      else if (type.includes('educational') || type.includes('school') || type.includes('classroom')) factor = params.load_factors['educational_classroom'];
      else if (type.includes('industrial') || type.includes('warehouse')) factor = params.load_factors['industrial_general'];
      else if (type.includes('residential') || type.includes('hotel') || type.includes('apartment')) factor = params.load_factors['residential'];
      else if (type.includes('storage')) factor = params.load_factors['storage'];
      else if (type.includes('mercantile') || type.includes('retail') || type.includes('store')) factor = params.load_factors['mercantile_ground'];
      var calcLoad = Math.ceil(area / factor);
      var declaredLoad = facts.occupantLoad || 0;
      if (declaredLoad && Math.abs(declaredLoad - calcLoad) > calcLoad * 0.2) {
        return { status: 'REVIEW', note: 'Declared load ' + declaredLoad + ' differs from calculated estimate ' + calcLoad + ' (using ' + factor + ' sq ft/person). Verify per IBC Table 1004.1.2.' };
      }
      return { status: 'PASS', note: 'Estimated occupant load: ~' + calcLoad + ' (' + area + ' sq ft ÷ ' + factor + ' sq ft/person).' };
    },

    stair_geometry: function (facts, params) {
      var tread = facts.stairTreadDepthIn || 0;
      var riser = facts.stairRiserHeightIn || 0;
      if (!tread && !riser) return { status: 'REVIEW', note: 'Stair tread/riser dimensions not found — manual verification required.' };
      var issues = [];
      if (tread && tread < params.min_tread_depth_in) issues.push('Tread depth ' + tread + ' in. < minimum ' + params.min_tread_depth_in + ' in.');
      if (riser && riser > params.max_riser_height_in) issues.push('Riser height ' + riser + ' in. exceeds maximum ' + params.max_riser_height_in + ' in.');
      if (riser && riser < params.min_riser_height_in) issues.push('Riser height ' + riser + ' in. is below minimum ' + params.min_riser_height_in + ' in.');
      if (issues.length) return { status: 'FLAGGED', note: issues.join(' ') };
      return { status: 'PASS', note: 'Stair geometry meets §1011.5 (tread ' + (tread || 'n/a') + ' in., riser ' + (riser || 'n/a') + ' in.).' };
    },

    stair_handrail: function (facts, params) {
      var stairWidth = facts.stairWidthInches || facts.corridorWidthInches || 0;
      var hasHandrails = facts.hasHandrails;
      if (hasHandrails === false) return { status: 'FLAGGED', note: 'Handrails not indicated on drawings. Required per §1011.11.' };
      if (!stairWidth) return { status: 'REVIEW', note: 'Stair width not extracted — verify handrails required on both sides if stair ≥ 44 in. wide.' };
      if (stairWidth >= params.required_both_sides_width_in && hasHandrails !== true) {
        return { status: 'REVIEW', note: 'Stair is ' + stairWidth + ' in. wide — handrails required on both sides per §1011.11.' };
      }
      return { status: 'PASS', note: 'Stair width ' + stairWidth + ' in.; handrail requirement reviewed.' };
    },

    fire_separation: function (facts, params) {
      var dist = facts.fireSeparationDistanceFt || facts.propertyLineDistanceFt || 0;
      if (!dist) return { status: 'REVIEW', note: 'Fire separation distance not found — verify exterior wall ratings per §705.5.' };
      if (dist < params.protected_min_ft) return { status: 'FLAGGED', note: 'Fire separation distance ' + dist + ' ft. Openings prohibited; walls require ≥ 1-hr rating per §705.5.' };
      if (dist < params.unprotected_min_ft) return { status: 'REVIEW', note: 'Distance ' + dist + ' ft requires protected openings and fire-rated exterior walls.' };
      return { status: 'PASS', note: 'Fire separation distance ' + dist + ' ft meets minimum unprotected-opening threshold.' };
    },

    sprinkler_required: function (facts, params) {
      var area = facts.grossArea || facts.floorArea || 0;
      var stories = facts.stories || 1;
      var height = facts.buildingHeightFt || 0;
      var hasSpk = facts.hasSprinklers;
      var reqd = area > params.area_threshold_sqft || stories >= params.stories_threshold || height > params.high_rise_ft;
      if (!reqd) return { status: 'PASS', note: 'Sprinkler system may not be required (area ' + area + ' sq ft, ' + stories + ' story).' };
      if (reqd && hasSpk === false) return { status: 'FLAGGED', note: 'Sprinkler system required (area ' + area + ' sq ft, ' + stories + ' stories) but not indicated.' };
      if (reqd && hasSpk === true) return { status: 'PASS', note: 'Sprinkler system indicated; meets §903.2 requirement.' };
      return { status: 'REVIEW', note: 'Sprinkler system likely required (area ' + area + ' sq ft, ' + stories + ' stories) — verify presence in plans.' };
    },

    door_width: function (facts, params) {
      var w = facts.doorWidthInches || facts.accessibleDoorWidthIn || 0;
      var load = facts.occupantLoad || 0;
      if (!w) return { status: 'REVIEW', note: 'Door clear width not found — verify minimum 32 in. (36 in. for occupant load > 50).' };
      var minW = load > 50 ? 36 : params.min_clear_width_in;
      if (w < minW) return { status: 'FLAGGED', note: 'Door clear width ' + w + ' in. is below required ' + minW + ' in. per §1010.1.1.' };
      return { status: 'PASS', note: 'Door clear width ' + w + ' in. meets §1010.1.1 minimum.' };
    },

    corridor_width: function (facts, params) {
      var w = facts.corridorWidthInches || 0;
      if (!w) return { status: 'REVIEW', note: 'Corridor width not extracted — verify minimum 44 in. per §1020.2.' };
      if (w < params.min_width_in) return { status: 'FLAGGED', note: 'Corridor width ' + w + ' in. below minimum ' + params.min_width_in + ' in. per §1020.2.' };
      return { status: 'PASS', note: 'Corridor width ' + w + ' in. meets §1020.2.' };
    },

    exit_signs: function (facts, params) {
      var load = facts.occupantLoad || 0;
      var hasSigns = facts.hasExitSigns;
      if (load <= params.occupant_load_threshold) return { status: 'PASS', note: 'Occupant load ' + load + ' — exit signs not required per §1013.1.' };
      if (hasSigns === false) return { status: 'FLAGGED', note: 'Exit signs required for occupant load ' + load + ' but not shown on plans.' };
      if (hasSigns === true) return { status: 'PASS', note: 'Exit signs indicated on plans; meets §1013.1.' };
      return { status: 'REVIEW', note: 'Occupant load ' + load + ' requires exit signs — verify locations on plan.' };
    },

    emergency_lighting: function (facts, params) {
      var hasEL = facts.hasEmergencyLighting;
      if (hasEL === true) return { status: 'PASS', note: 'Emergency egress lighting indicated; verify 1 fc minimum and 1.5-hr duration per §1008.1.' };
      if (hasEL === false) return { status: 'FLAGGED', note: 'Emergency egress lighting not shown. Required per §1008.1 with 1.5-hr battery backup.' };
      return { status: 'REVIEW', note: 'Emergency lighting not verified — confirm battery-backup lighting along all egress paths per §1008.1.' };
    },

    plumbing_fixtures: function (facts, params) {
      var load = facts.occupantLoad || 0;
      if (!load) return { status: 'REVIEW', note: 'Occupant load unknown — cannot verify plumbing fixture count per IBC Table 2902.1.' };
      var male = Math.ceil(load / 2);
      var reqToiletM = Math.ceil(male / params.toilet_ratio_male);
      var reqToiletF = Math.ceil((load - male) / params.toilet_ratio_female);
      return { status: 'REVIEW', note: 'Verify: ≥ ' + reqToiletM + ' toilet(s) for male occupants, ≥ ' + reqToiletF + ' for female occupants per IBC Table 2902.1.' };
    },

    ventilation: function (facts, params) {
      var area = facts.grossArea || facts.floorArea || 0;
      var hasVent = facts.hasMechVentilation || facts.hasNatVentilation;
      if (!area) return { status: 'REVIEW', note: 'Floor area unknown — cannot verify ventilation opening area per §1203.' };
      if (hasVent === false) return { status: 'FLAGGED', note: 'No ventilation system indicated. Provide natural (4% of floor area) or mechanical ventilation per §1203.' };
      return { status: 'REVIEW', note: 'Verify ventilation: natural openings ≥ ' + Math.ceil(area * params.min_vent_area_pct / 100) + ' sq ft, or mechanical per ASHRAE 62.1.' };
    },

    // ── ADA checks ─────────────────────────────────────────────
    accessible_route_width: function (facts, params) {
      var w = facts.accessibleRouteWidthIn || facts.corridorWidthInches || 0;
      if (!w) return { status: 'REVIEW', note: 'Accessible route width not found — verify minimum 36 in. clear per ADA §402.2.' };
      if (w < params.min_width_in) return { status: 'FLAGGED', note: 'Accessible route width ' + w + ' in. < minimum ' + params.min_width_in + ' in. per ADA §402.2.' };
      return { status: 'PASS', note: 'Accessible route width ' + w + ' in. meets ADA §402.2 minimum.' };
    },

    turning_space: function (facts, params) {
      var r = facts.adaTurningRadiusIn || facts.turningDiameterIn || 0;
      if (!r) return { status: 'REVIEW', note: 'ADA turning space not extracted — verify 60 in. diameter clear space per §304.' };
      var diam = r >= 60 ? r : r * 2;
      if (diam < params.min_diameter_in) return { status: 'FLAGGED', note: 'Turning diameter ' + diam + ' in. < required ' + params.min_diameter_in + ' in. per ADA §304.3.' };
      return { status: 'PASS', note: 'Turning space ' + diam + ' in. diameter meets ADA §304.3.' };
    },

    accessible_door_width: function (facts, params) {
      var w = facts.doorWidthInches || facts.accessibleDoorWidthIn || 0;
      if (!w) return { status: 'REVIEW', note: 'Door clear width not found — verify minimum 32 in. per ADA §404.2.3.' };
      if (w < params.min_clear_width_in) return { status: 'FLAGGED', note: 'Door clear width ' + w + ' in. < ADA minimum ' + params.min_clear_width_in + ' in. per §404.2.3.' };
      return { status: 'PASS', note: 'Door clear width ' + w + ' in. meets ADA §404.2.3.' };
    },

    door_maneuvering: function (facts, params) {
      var clearance = facts.doorManeuveringClearanceIn || 0;
      if (!clearance) return { status: 'REVIEW', note: 'Door maneuvering clearance not extracted — verify per ADA §404.2.4 (latch side: min 18 in.).' };
      if (clearance < params.latch_side_front_approach_in) return { status: 'FLAGGED', note: 'Maneuvering clearance ' + clearance + ' in. < ADA minimum 18 in. latch-side clearance.' };
      return { status: 'PASS', note: 'Door maneuvering clearance ' + clearance + ' in. meets ADA §404.2.4.' };
    },

    ramp_slope: function (facts, params) {
      var slope = facts.rampSlope || facts.rampRunningSlope || 0;
      if (!slope) return { status: 'REVIEW', note: 'Ramp slope not found — verify maximum 1:12 running slope per ADA §405.2.' };
      if (slope > params.max_running_slope) return { status: 'FLAGGED', note: 'Ramp slope ' + (slope * 100).toFixed(1) + '% exceeds maximum 8.33% (1:12) per ADA §405.2.' };
      return { status: 'PASS', note: 'Ramp slope ' + (slope * 100).toFixed(1) + '% (≤ 8.33%) meets ADA §405.2.' };
    },

    ramp_edge: function (facts, params) {
      var hasEdge = facts.hasRampEdgeProtection;
      if (hasEdge === false) return { status: 'FLAGGED', note: 'Ramp edge protection not shown. Provide 4-in. curb or barrier on open ramp sides per ADA §405.9.' };
      if (hasEdge === true) return { status: 'PASS', note: 'Ramp edge protection indicated.' };
      return { status: 'REVIEW', note: 'Verify ramp edge protection (4-in. curb or rail on all open sides) per ADA §405.9.' };
    },

    accessible_parking: function (facts, params) {
      var total = facts.totalParkingSpaces || 0;
      var accessible = facts.accessibleParkingSpaces || 0;
      if (!total) return { status: 'REVIEW', note: 'Parking count not found — verify accessible space count per ADA §502.2.' };
      var required = 1;
      for (var i = 0; i < params.ratio_table.length; i++) {
        if (total <= params.ratio_table[i].max_total) { required = params.ratio_table[i].min_accessible; break; }
        required = params.ratio_table[i].min_accessible + 1;
      }
      if (!accessible) return { status: 'REVIEW', note: 'Accessible parking count not verified — ' + required + ' space(s) required for ' + total + ' total spaces.' };
      if (accessible < required) return { status: 'FLAGGED', note: accessible + ' accessible space(s) provided; ' + required + ' required for ' + total + ' total spaces.' };
      return { status: 'PASS', note: accessible + ' accessible space(s) provided; ' + required + ' required. Meets ADA §502.2.' };
    },

    accessible_parking_dims: function (facts, params) {
      var stallW = facts.accessibleParkingStallWidthIn || 0;
      if (!stallW) return { status: 'REVIEW', note: 'Accessible parking stall dimensions not found — verify 96 in. minimum stall width per ADA §502.3.' };
      if (stallW < params.min_stall_width_in) return { status: 'FLAGGED', note: 'Accessible stall width ' + stallW + ' in. < minimum ' + params.min_stall_width_in + ' in. per ADA §502.3.' };
      return { status: 'PASS', note: 'Accessible stall width ' + stallW + ' in. meets ADA §502.3 minimum.' };
    },

    toilet_room_turning: function (facts, params) {
      var r = facts.toiletRoomTurningDiameterIn || facts.adaTurningRadiusIn || 0;
      if (!r) return { status: 'REVIEW', note: 'Toilet room turning space not found — verify 60 in. diameter per ADA §603.2.1.' };
      var diam = r >= 60 ? r : r * 2;
      if (diam < params.min_diameter_in) return { status: 'FLAGGED', note: 'Toilet room turning space ' + diam + ' in. < required ' + params.min_diameter_in + ' in. per §603.2.1.' };
      return { status: 'PASS', note: 'Toilet room turning space ' + diam + ' in. meets ADA §603.2.1.' };
    },

    toilet_clearance: function (facts, params) {
      var side = facts.toiletSideClearanceIn || 0;
      var front = facts.toiletFrontClearanceIn || 0;
      if (!side && !front) return { status: 'REVIEW', note: 'Toilet clearances not extracted — verify 60 in. transfer side, 48 in. front per ADA §604.3.' };
      var issues = [];
      if (side && side < params.min_side_transfer_in) issues.push('Side clearance ' + side + ' in. < 60 in.');
      if (front && front < params.min_front_clearance_in) issues.push('Front clearance ' + front + ' in. < 48 in.');
      if (issues.length) return { status: 'FLAGGED', note: issues.join('; ') + ' per ADA §604.3.' };
      return { status: 'PASS', note: 'Toilet clearances meet ADA §604.3.' };
    },

    reach_range: function (facts, params) {
      var maxH = facts.controlHeightIn || facts.dispenserHeightIn || 0;
      if (!maxH) return { status: 'REVIEW', note: 'Control/dispenser heights not found — verify 15–48 in. AFF forward reach range per ADA §308.2.' };
      if (maxH > params.max_height_in) return { status: 'FLAGGED', note: 'Control height ' + maxH + ' in. AFF exceeds maximum ' + params.max_height_in + ' in. per ADA §308.2.' };
      if (maxH < params.min_height_in) return { status: 'FLAGGED', note: 'Control height ' + maxH + ' in. AFF is below minimum ' + params.min_height_in + ' in. per ADA §308.2.' };
      return { status: 'PASS', note: 'Control height ' + maxH + ' in. AFF within 15–48 in. reach range per ADA §308.2.' };
    },

    handrail_grip: function (facts, params) {
      var od = facts.handrailDiameterIn || 0;
      if (!od) return { status: 'REVIEW', note: 'Handrail dimensions not found — verify 1.25–2 in. diameter circular section per ADA §505.4.' };
      if (od < params.circular_od_min_in || od > params.circular_od_max_in) {
        return { status: 'FLAGGED', note: 'Handrail diameter ' + od + ' in. is outside ADA §505.4 acceptable range of ' + params.circular_od_min_in + '–' + params.circular_od_max_in + ' in.' };
      }
      return { status: 'PASS', note: 'Handrail diameter ' + od + ' in. meets ADA §505.4.' };
    },

    // ── NFPA checks ─────────────────────────────────────────────
    nfpa_occupant_load: function (facts, params) {
      var area = facts.grossArea || facts.floorArea || 0;
      if (!area) return { status: 'REVIEW', note: 'Floor area unknown — verify occupant load per NFPA 101 Table 7.3.1.2.' };
      return { status: 'REVIEW', note: 'Verify occupant load using NFPA 101 Table 7.3.1.2 factors. Estimated for business: ~' + Math.ceil(area / 100) + ' persons.' };
    },

    travel_distance: function (facts, params) {
      var dist = facts.travelDistanceFt || 0;
      var sprinklered = facts.hasSprinklers === true;
      var type = (facts.occupancyGroup || facts.buildingType || 'business').toLowerCase();
      var maxDist;
      if (type.includes('assembly')) maxDist = sprinklered ? params.max_travel_ft.assembly_sprinklered : params.max_travel_ft.assembly_unsprinklered;
      else if (type.includes('mercantile') || type.includes('retail')) maxDist = sprinklered ? params.max_travel_ft.mercantile_sprinklered : params.max_travel_ft.mercantile_unsprinklered;
      else if (type.includes('industrial') || type.includes('warehouse')) maxDist = sprinklered ? params.max_travel_ft.industrial_general_sprinklered : params.max_travel_ft.industrial_general_unsprinklered;
      else maxDist = sprinklered ? params.max_travel_ft.business_sprinklered : params.max_travel_ft.business_unsprinklered;
      if (!dist) return { status: 'REVIEW', note: 'Travel distance not indicated — verify maximum ' + maxDist + ' ft per NFPA 101 §7.6.1.' };
      if (dist > maxDist) return { status: 'FLAGGED', note: 'Travel distance ' + dist + ' ft exceeds maximum ' + maxDist + ' ft per NFPA 101 §7.6.1.' };
      return { status: 'PASS', note: 'Travel distance ' + dist + ' ft within ' + maxDist + ' ft limit per NFPA 101 §7.6.1.' };
    },

    nfpa_egress_capacity: function (facts, params) {
      var load = facts.occupantLoad || 0;
      var stairW = facts.stairWidthInches || 0;
      var corrW = facts.corridorWidthInches || 0;
      if (!load) return { status: 'REVIEW', note: 'Occupant load not verified — cannot calculate NFPA egress capacity requirement.' };
      var reqStair = Math.ceil(load * params.stair_in_per_person);
      var reqCorr = Math.ceil(load * params.level_in_per_person);
      if (stairW && stairW < Math.max(reqStair, params.min_door_in)) return { status: 'FLAGGED', note: 'Stair width ' + stairW + ' in. insufficient for occupant load ' + load + ' (requires ' + reqStair + ' in. per NFPA §7.3.3).' };
      return { status: 'REVIEW', note: 'Verify: stair width ≥ ' + reqStair + ' in. and corridor width ≥ ' + Math.max(reqCorr, 36) + ' in. for occupant load ' + load + '.' };
    },

    exit_discharge: function (facts, params) {
      var dischargesOutside = facts.exitDischargesDirectlyOutside;
      if (dischargesOutside === false) return { status: 'FLAGGED', note: 'Exit stair(s) do not discharge directly outside. At least 50% must discharge directly to grade per NFPA 101 §7.7.' };
      if (dischargesOutside === true) return { status: 'PASS', note: 'Exit discharge to exterior at grade per NFPA 101 §7.7.' };
      return { status: 'REVIEW', note: 'Verify exit stair discharge: ≥ 50% must exit directly outside at grade per NFPA 101 §7.7.' };
    },

    nfpa_emergency_lighting: function (facts, params) {
      var hasEL = facts.hasEmergencyLighting;
      if (hasEL === true) return { status: 'PASS', note: 'Emergency lighting indicated. Verify 1 fc initial and 0.6 fc at 90 min per NFPA 101 §7.9.' };
      if (hasEL === false) return { status: 'FLAGGED', note: 'Emergency lighting not shown. Required per NFPA 101 §7.9 with 1.5-hr battery backup.' };
      return { status: 'REVIEW', note: 'Verify battery-backup emergency lighting along egress paths per NFPA 101 §7.9.' };
    },

    nfpa_exit_signs: function (facts, params) {
      var hasSigns = facts.hasExitSigns;
      if (hasSigns === true) return { status: 'PASS', note: 'Exit signs indicated. Verify 6-in. letter height and 100-ft viewing distance per NFPA 101 §7.10.' };
      if (hasSigns === false) return { status: 'FLAGGED', note: 'Exit signs not shown. Required with 1.5-hr battery backup per NFPA 101 §7.10.' };
      return { status: 'REVIEW', note: 'Verify illuminated exit signs at all exits and direction changes per NFPA 101 §7.10.' };
    },

    smoke_compartments: function (facts, params) {
      var area = facts.grossArea || facts.floorArea || 0;
      var type = (facts.occupancyGroup || facts.buildingType || '').toLowerCase();
      if (!type.includes('institution') && !type.includes('health') && !type.includes('hospital')) {
        return { status: 'PASS', note: 'Smoke compartmentation per NFPA 101 §8.3 not required for this occupancy type.' };
      }
      if (area > params.healthcare_max_area_sqft) return { status: 'FLAGGED', note: 'Floor area ' + area + ' sq ft exceeds 22,500 sq ft smoke compartment limit per NFPA 101 §8.3.' };
      return { status: 'REVIEW', note: 'Healthcare occupancy: verify smoke compartments ≤ 22,500 sq ft with 1-hr smoke barriers per NFPA 101 §8.3.' };
    },

    fire_alarm: function (facts, params) {
      var load = facts.occupantLoad || 0;
      var area = facts.grossArea || facts.floorArea || 0;
      var stories = facts.stories || 1;
      var hasAlarm = facts.hasFireAlarm;
      var required = load > params.occupant_load_threshold || area > params.area_threshold_sqft || stories >= params.stories_threshold;
      if (!required) return { status: 'REVIEW', note: 'Verify fire alarm requirement based on final occupancy classification per NFPA 101 occupancy chapters.' };
      if (required && hasAlarm === false) return { status: 'FLAGGED', note: 'Fire alarm system required (load ' + load + ', area ' + area + ' sq ft) but not indicated on plans.' };
      if (required && hasAlarm === true) return { status: 'PASS', note: 'Fire alarm indicated; verify NFPA 72 compliance per NFPA 101 §9.6.' };
      return { status: 'REVIEW', note: 'Fire alarm likely required — verify NFPA 72-compliant system on plans.' };
    },

    // ── Generic v3 checks ──────────────────────────────────────────────
    // `manual` — explicit reviewer-attention rule. Uses notes_template if present.
    manual: function (facts, params, ctx) {
      var note = (ctx && ctx.renderedNote) ||
        'Manual verification required — see citation for the applicable code section.';
      return { status: 'REVIEW', note: note };
    }
  };

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Resolve effective parameters for a rule given the current facts and
   * pack-level placeholders. Honors `parameters_by` precedence:
   *   default < occupancy.<group> < sprinklered.<bool> < construction.<type>
   *           < stories.<bracket>
   * The most-specific selector wins; selectors are merged on top of `default`.
   * Falls back to the legacy flat `parameters` object when no `parameters_by`
   * is present.
   *
   * Selectors recognized (string-equality or numeric-bracket):
   *   default
   *   occupancy.<A|B|E|F|H|I|M|R|S|U>
   *   sprinklered.<true|false>
   *   construction.<I-A|I-B|II-A|II-B|III-A|III-B|IV|V-A|V-B|...>
   *   stories.lte.<n>  / stories.gte.<n>
   *   <key>.<value>           — generic match against facts or placeholders
   */
  function resolveParameters(rule, facts, placeholders) {
    if (!rule.parameters_by) return rule.parameters || {};
    var pb = rule.parameters_by;
    var ctx = _buildContext(facts, placeholders);
    var merged = Object.assign({}, pb['default'] || rule.parameters || {});
    // Apply selectors in declared order so later ones win — except 'default'
    // which is always the base.
    Object.keys(pb).forEach(function (sel) {
      if (sel === 'default') return;
      if (_selectorMatches(sel, ctx)) {
        merged = _shallowMerge(merged, pb[sel]);
      }
    });
    return merged;
  }

  function _buildContext(facts, placeholders) {
    facts = facts || {};
    placeholders = placeholders || {};
    var occ = (facts.occupancyGroup || facts.useGroup || '').toString().toUpperCase();
    return {
      facts: facts,
      placeholders: placeholders,
      occupancy: occ,
      sprinklered: facts.hasSprinklers === true || placeholders.sprinklered === true,
      construction: (facts.constructionType || placeholders.construction_type || '').toString(),
      stories: facts.stories || 1
    };
  }

  function _selectorMatches(sel, ctx) {
    var parts = sel.split('.');
    var key = parts[0];
    if (parts.length === 2) {
      var val = parts[1];
      if (key === 'occupancy')    return ctx.occupancy === val.toUpperCase();
      if (key === 'sprinklered')  return String(ctx.sprinklered) === val;
      if (key === 'construction') return ctx.construction === val;
      // Generic facts/placeholders match
      if (ctx.facts[key] !== undefined)        return String(ctx.facts[key]) === val;
      if (ctx.placeholders[key] !== undefined) return String(ctx.placeholders[key]) === val;
      return false;
    }
    if (parts.length === 3 && key === 'stories') {
      var op = parts[1], n = parseFloat(parts[2]);
      if (op === 'lte') return ctx.stories <= n;
      if (op === 'gte') return ctx.stories >= n;
      if (op === 'lt')  return ctx.stories <  n;
      if (op === 'gt')  return ctx.stories >  n;
      if (op === 'eq')  return ctx.stories === n;
    }
    return false;
  }

  function _shallowMerge(a, b) {
    var out = {};
    Object.keys(a || {}).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b || {}).forEach(function (k) { out[k] = b[k]; });
    return out;
  }

  /**
   * Evaluate a whitelisted boolean expression against facts and placeholders.
   * Supports: `facts.X`, `placeholders.X`, comparison operators (== != < <= > >=),
   * boolean operators (&& || !), parentheses, numeric & string & boolean literals.
   * Anything else is rejected — no `eval`, no `Function`, no property access
   * outside the two safe roots.
   * Returns true on parse failure (fail-open) so a malformed expression doesn't
   * silently disable a rule.
   */
  function evaluateAppliesWhen(expr, facts, placeholders) {
    if (!expr || typeof expr !== 'string') return true;
    if (expr.length > 500) return true; // refuse pathological inputs
    // Whitelist: only the safe character set + the words true/false/facts/placeholders
    if (!/^[\sA-Za-z0-9_.()'"!=<>&|+\-*/?:,]+$/.test(expr)) return true;
    // Forbid keywords that could break out of the sandbox
    if (/(^|[^A-Za-z0-9_])(this|window|globalThis|constructor|prototype|Function|eval|require|import|process)([^A-Za-z0-9_]|$)/.test(expr)) return true;
    // Tokenize identifiers and only allow facts.* / placeholders.* / true / false
    var idents = expr.match(/[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*/g) || [];
    for (var i = 0; i < idents.length; i++) {
      var head = idents[i].split('.')[0];
      if (head !== 'facts' && head !== 'placeholders' && head !== 'true' && head !== 'false' && head !== 'null') return true;
    }
    try {
      // eslint-disable-next-line no-new-func
      var fn = new Function('facts', 'placeholders', '"use strict"; return (' + expr + ');');
      return !!fn(facts || {}, placeholders || {});
    } catch (e) {
      return true;
    }
  }

  /**
   * Render a Mustache-lite notes_template against a context object.
   * Supports `{{key}}` substitution and `{{key.path}}` lookups. No conditionals,
   * no loops, no helpers — keep it simple and safe.
   */
  function renderTemplate(tpl, context) {
    if (!tpl || typeof tpl !== 'string') return '';
    return tpl.replace(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g, function (_, path) {
      var parts = path.split('.');
      var v = context;
      for (var i = 0; i < parts.length; i++) {
        if (v === null || v === undefined) return '';
        v = v[parts[i]];
      }
      if (v === null || v === undefined) return '';
      return String(v);
    });
  }

  /**
   * Evaluate a set of rule packs against extracted facts.
   * @param {Object} facts        - Extracted plan facts
   * @param {Array}  packs        - Array of loaded rule-pack objects
   * @param {string} buildingType - e.g. "Commercial"
   * @param {Object} [opts]       - { placeholders: {...} } (optional)
   * @returns {Array} Array of finding objects (deduplicated by alias group)
   */
  function evaluate(facts, packs, buildingType, opts) {
    opts = opts || {};
    var globalPlaceholders = opts.placeholders || {};
    var raw = [];
    var L = (typeof window !== 'undefined' && window.PE && window.PE.Log) ? window.PE.Log : null;
    var skipped = { applies_to: 0, applies_when: 0, disabled: 0 };

    packs.forEach(function (pack) {
      if (!pack || !Array.isArray(pack.rules)) return;
      // Merge pack-level placeholder defaults with user overrides for this pack.
      var packPlaceholders = _placeholderDefaults(pack);
      Object.keys(globalPlaceholders).forEach(function (k) {
        if (globalPlaceholders[k] !== undefined && globalPlaceholders[k] !== null && globalPlaceholders[k] !== '') {
          packPlaceholders[k] = globalPlaceholders[k];
        }
      });

      pack.rules.forEach(function (rule) {
        if (rule.disabled) {
          skipped.disabled++;
          if (L) L.trace('rule-engine', 'skip ' + pack.id + '/' + rule.id + ' (disabled)');
          return;
        }
        if (!rule.applies_to || !rule.applies_to.some(function (t) { return t === buildingType || t === 'Other'; })) {
          skipped.applies_to++;
          if (L) L.trace('rule-engine', 'skip ' + pack.id + '/' + rule.id + ' (applies_to mismatch)', { applies_to: rule.applies_to, buildingType: buildingType });
          return;
        }
        if (rule.applies_when && !evaluateAppliesWhen(rule.applies_when, facts, packPlaceholders)) {
          skipped.applies_when++;
          if (L) L.trace('rule-engine', 'skip ' + pack.id + '/' + rule.id + ' (applies_when=false)', { expr: rule.applies_when });
          return;
        }

        var params = resolveParameters(rule, facts, packPlaceholders);
        var checkFn = checks[rule.check_fn];
        var renderedNote = rule.notes_template
          ? renderTemplate(rule.notes_template, { facts: facts, placeholders: packPlaceholders, params: params })
          : '';

        var outcome;
        if (!rule.check_fn || rule.check_fn === 'manual') {
          // Stub / deliberately-manual rule: surface as REVIEW with rich note.
          outcome = checks.manual(facts, params, { renderedNote: renderedNote });
        } else if (!checkFn) {
          outcome = {
            status: 'REVIEW',
            note: renderedNote || ('Check function "' + rule.check_fn + '" not implemented in this build — manual verification required.')
          };
        } else {
          try {
            outcome = checkFn(facts, params, { rule: rule, placeholders: packPlaceholders, renderedNote: renderedNote });
          } catch (e) {
            outcome = { status: 'REVIEW', note: 'Rule evaluation error: ' + (e && e.message ? e.message : 'unknown') + ' — verify manually.' };
            if (L) L.warn('rule-engine', 'check error in ' + pack.id + '/' + rule.id, { error: e && e.message });
          }
        }

        // Coverage hint: mark REVIEW notes when evidence_keys are missing entirely.
        if (outcome.status === 'REVIEW' && Array.isArray(rule.evidence_keys) && rule.evidence_keys.length) {
          var missing = rule.evidence_keys.filter(function (k) {
            return facts[k] === undefined || facts[k] === null || facts[k] === '';
          });
          if (missing.length === rule.evidence_keys.length) {
            outcome.note = (outcome.note ? outcome.note + ' ' : '') +
              '(Missing evidence: ' + missing.join(', ') + '.)';
            if (L) L.info('rule-engine', 'missing-evidence skip ' + pack.id + '/' + rule.id, { missing: missing });
          }
        }

        if (L) {
          var factsUsed = {};
          (rule.evidence_keys || []).forEach(function (k) { if (facts[k] !== undefined) factsUsed[k] = facts[k]; });
          L.debug('rule-engine', 'rule ' + pack.id + '/' + rule.id + ' → ' + outcome.status, {
            packId: pack.id, ruleId: rule.id, status: outcome.status,
            note: outcome.note, factsUsed: factsUsed
          });
        }

        raw.push({
          id:           rule.id,
          pack_id:      pack.id,
          pack_name:    pack.name,
          label:        rule.label,
          category:     rule.category,
          severity:     rule.severity || 'medium',
          status:       outcome.status,
          note:         outcome.note || '',
          citation:     rule.citation || '',
          remediation:  rule.remediation || '',
          code_section: rule.code_section,
          aliases:      rule.aliases || [],
          references:   rule.references || [],
          tags:         rule.tags || [],
          experimental: !!rule.experimental,
          source_url:   pack.source_url || '',
          license:      pack.license || ''
        });
      });
    });

    var deduped = _dedupeByAliases(raw);
    if (L) L.info('rule-engine', 'evaluation complete', {
      packs: packs.length,
      rulesEvaluated: raw.length,
      skipped: skipped,
      findingsAfterDedupe: deduped.length
    });
    return deduped;
  }

  function _placeholderDefaults(pack) {
    var out = {};
    if (pack.placeholders && typeof pack.placeholders === 'object') {
      Object.keys(pack.placeholders).forEach(function (k) {
        var spec = pack.placeholders[k];
        if (spec && spec.default !== undefined) out[k] = spec.default;
      });
    }
    return out;
  }

  /**
   * Merge findings that point at the same logical requirement via `aliases`.
   * Two findings collapse when the union of (rule.id ∪ rule.aliases) intersects.
   * The most-severe status wins (FLAGGED > REVIEW > PASS); citations are stacked.
   */
  function _dedupeByAliases(findings) {
    var groups = [];
    var index = {};       // id → group index
    findings.forEach(function (f) {
      var keys = [f.id].concat(f.aliases || []);
      var hit = -1;
      for (var i = 0; i < keys.length; i++) {
        if (index[keys[i]] !== undefined) { hit = index[keys[i]]; break; }
      }
      if (hit === -1) {
        var g = { primary: f, members: [f] };
        groups.push(g);
        var gi = groups.length - 1;
        keys.forEach(function (k) { index[k] = gi; });
      } else {
        groups[hit].members.push(f);
        keys.forEach(function (k) { if (index[k] === undefined) index[k] = hit; });
        // Promote to most-severe status / preserve original citation chain.
        if (_statusRank(f.status) > _statusRank(groups[hit].primary.status)) {
          groups[hit].primary = f;
        }
      }
    });
    return groups.map(function (g) {
      if (g.members.length === 1) return g.primary;
      var citations = g.members
        .map(function (m) { return m.code_section ? (m.code_section + (m.note ? ': ' + m.note : '')) : ''; })
        .filter(Boolean);
      var stacked = Object.assign({}, g.primary, {
        note:        g.primary.note,
        stacked_citations: g.members.map(function (m) {
          return { pack_id: m.pack_id, pack_name: m.pack_name, code_section: m.code_section, citation: m.citation };
        }),
        citation:    citations.join(' | ')
      });
      return stacked;
    });
  }

  function _statusRank(s) { return s === 'FLAGGED' ? 3 : s === 'REVIEW' ? 2 : s === 'PASS' ? 1 : 0; }

  /**
   * Compute a compliance score 0–100 from an array of findings.
   */
  function score(findings) {
    if (!findings.length) return 100;
    var weights = { FLAGGED: 3, REVIEW: 1, PASS: 0 };
    var total   = 0;
    var max     = 0;
    findings.forEach(function (f) {
      if (f.experimental) return; // don't penalize stubs
      var sev = f.severity === 'critical' ? 3 : f.severity === 'high' ? 2 : 1;
      var w = (weights[f.status] || 0) * sev;
      total += w;
      max   += 3 * sev;
    });
    if (!max) return 100;
    return Math.round(100 - (total / max) * 100);
  }

  /**
   * Build a coverage report: which fact keys were referenced by enabled rules
   * but are missing from the extracted facts. Useful for the agentic UI to
   * prompt the reviewer for manual data entry.
   */
  function coverageReport(facts, packs, buildingType) {
    var byKey = {};
    packs.forEach(function (pack) {
      if (!pack || !Array.isArray(pack.rules)) return;
      pack.rules.forEach(function (rule) {
        if (rule.disabled) return;
        if (!rule.applies_to || !rule.applies_to.some(function (t) { return t === buildingType || t === 'Other'; })) return;
        (rule.evidence_keys || []).forEach(function (k) {
          if (!byKey[k]) byKey[k] = { key: k, missing: false, used_by: [] };
          byKey[k].used_by.push({ pack_id: pack.id, rule_id: rule.id });
          if (facts[k] === undefined || facts[k] === null || facts[k] === '') {
            byKey[k].missing = true;
          }
        });
      });
    });
    return Object.keys(byKey).map(function (k) { return byKey[k]; });
  }

  return {
    evaluate: evaluate,
    score: score,
    resolveParameters: resolveParameters,
    evaluateAppliesWhen: evaluateAppliesWhen,
    renderTemplate: renderTemplate,
    coverageReport: coverageReport,
    // Exposed for unit/manual testing
    _checks: checks
  };

}());

window.PE = PE;
