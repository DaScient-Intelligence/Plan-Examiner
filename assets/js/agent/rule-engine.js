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
    }
  };

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Evaluate a set of rule packs against extracted facts.
   * @param {Object} facts - Extracted plan facts
   * @param {Array}  packs - Array of loaded rule-pack objects
   * @param {string} buildingType - e.g. "Commercial"
   * @returns {Array} Array of finding objects
   */
  function evaluate(facts, packs, buildingType) {
    var results = [];

    packs.forEach(function (pack) {
      if (!pack || !Array.isArray(pack.rules)) return;

      pack.rules.forEach(function (rule) {
        if (!rule.applies_to.some(function (t) { return t === buildingType || t === 'Other'; })) return;

        var checkFn = checks[rule.check_fn];
        if (!checkFn) {
          results.push({
            id:          rule.id,
            label:       rule.label,
            category:    rule.category,
            severity:    rule.severity,
            status:      'REVIEW',
            note:        'Check function not implemented — manual verification required.',
            citation:    rule.citation,
            remediation: rule.remediation,
            code_section: rule.code_section
          });
          return;
        }

        var outcome = checkFn(facts, rule.parameters || {});
        results.push({
          id:          rule.id,
          label:       rule.label,
          category:    rule.category,
          severity:    rule.severity,
          status:      outcome.status,
          note:        outcome.note || '',
          citation:    rule.citation,
          remediation: rule.remediation,
          code_section: rule.code_section
        });
      });
    });

    return results;
  }

  /**
   * Compute a compliance score 0–100 from an array of findings.
   */
  function score(findings) {
    if (!findings.length) return 100;
    var weights = { FLAGGED: 3, REVIEW: 1, PASS: 0 };
    var total   = 0;
    var max     = 0;
    findings.forEach(function (f) {
      var sev = f.severity === 'critical' ? 3 : f.severity === 'high' ? 2 : 1;
      var w = (weights[f.status] || 0) * sev;
      total += w;
      max   += 3 * sev;
    });
    return Math.round(100 - (total / max) * 100);
  }

  return { evaluate: evaluate, score: score };

}());

window.PE = PE;
