// Sun position for the set day, time and latitude: sun light, shadows, sky
// and bloom follow it; state.solar keeps the last elevation and azimuth.
import * as THREE from 'three';
import { solarPosition, compassDirection } from '../geo.js';
import { state } from './state.js';
import { scene, bloomPass, sun, sunDirection, fitSunShadow, atmosphere } from './scene.js';
import { settings } from './settings.js';

export function updateTimeOfDay() {
  const t = settings.timeOfDay;
  const dayOfYear = Math.max(1, Math.min(365, settings.dayOfYear || 172));
  const latitude = Math.max(-66, Math.min(66, settings.latitude == null ? 39 : settings.latitude));

  const { elevation, azimuth } = solarPosition(t, dayOfYear, latitude);
  const elevationDeg = THREE.MathUtils.radToDeg(elevation);
  const azimuthDeg = (THREE.MathUtils.radToDeg(azimuth) + 360) % 360;
  state.solar = { elevationDeg, azimuthDeg };

  const pos = compassDirection(azimuth, elevation);

  sunDirection.copy(pos);
  fitSunShadow();
  // Smooth intensity ramp at horizon (golden hour feel)
  sun.intensity = elevationDeg > 0 ? 1.25 * Math.min(1, elevationDeg / 18) : 0;
  sun.shadow.needsUpdate = true;

  scene.fog.density = settings.fogDensity;
  atmosphere.update(settings.atmosphere, pos, elevationDeg);
  atmosphere.applyEnvironmentIntensity(scene, settings.atmosphere);

  // Night Mode effects
  const isNight = elevationDeg < -3;
  
  // Toggle bloom based on night mode and settings
  bloomPass.strength = (isNight && settings.enableBloom) ? 1.2 : 0.0;
  bloomPass.enabled = bloomPass.strength > 0;
  
  // We will apply emissive changes when generating materials, 
  // but let's just trigger a scene rebuild if day/night status changes to refresh building windows.
  // We can track lastNightMode to avoid infinite loops.
}
