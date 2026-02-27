import { ref, onMounted, nextTick } from 'vue';
import proj4 from 'proj4';
import 'proj4leaflet';

export function useMap(t) { // Pass the translator function 't'
  const mapContainer = ref(null);
  let map = null;

  // Define a palette of colors to cycle through for each geometry
  const colorPalette = [
    '#3b82f6', // blue-500
    '#ef4444', // red-500
    '#22c55e', // green-500
    '#eab308', // yellow-500
    '#a855f7', // purple-500
    '#ec4899', // pink-500
    '#f97316', // orange-500
    '#14b8a6', // teal-500
  ];

  // Define the projections we need
  const setupProjections = () => {
    // ED50 / UTM zone 29N (EPSG:23029) - Common in Galicia, Spain
    proj4.defs('EPSG:23029', '+proj=utm +zone=29 +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs');

    // ETRS89 / UTM zone 29N (EPSG:25829) - Modern standard in Galicia
    proj4.defs('EPSG:25829', '+proj=utm +zone=29 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

    // Web Mercator (EPSG:3857)
    proj4.defs('EPSG:3857', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs');
  };

  // Helper function to parse geometry data in various formats
  const parseGeometry = (geomData) => {
    if (!geomData) return null;

    try {
      // If it's already an object
      if (typeof geomData === 'object' && !Array.isArray(geomData)) return geomData;

      // If it's a JSON string
      if (typeof geomData === 'string') {
        try {
          return JSON.parse(geomData);
        } catch (e) {
          console.warn('Could not parse geometry as JSON:', e);
          // It might be WKT or WKB, which we don't handle in this simplified version
          return null;
        }
      }

      return null;
    } catch (error) {
      console.error('Error parsing geometry:', error);
      return null;
    }
  };

  // Transform GeoJSON to WGS84 (EPSG:4326) for Leaflet
  const transformGeoJson = (geoJson) => {
    if (!geoJson) return null;

    try {
      // Handle CRS transformation if needed
      if (geoJson.crs && geoJson.crs.properties && geoJson.crs.properties.name) {
        const sourceCRS = geoJson.crs.properties.name;

        // Clone the GeoJSON to avoid modifying the original
        const transformedGeoJson = JSON.parse(JSON.stringify(geoJson));

        // Process coordinates based on geometry type
        const processCoordinates = (coords, depth) => {
          if (depth === 0) {
            // We've reached actual coordinates [x, y]
            const transformed = proj4(sourceCRS, 'EPSG:4326', coords);
            // Leaflet uses [lat, lng] order, while GeoJSON uses [lng, lat]
            return [transformed[1], transformed[0]];
          } else {
            // We're still in a nested array structure
            return coords.map(c => processCoordinates(c, depth - 1));
          }
        };

        // Determine depth based on geometry type
        let depth;
        switch (transformedGeoJson.type) {
          case 'Point':
            depth = 0;
            transformedGeoJson.coordinates = processCoordinates(transformedGeoJson.coordinates, depth);
            break;
          case 'LineString':
          case 'MultiPoint':
            depth = 1;
            transformedGeoJson.coordinates = processCoordinates(transformedGeoJson.coordinates, depth);
            break;
          case 'Polygon':
          case 'MultiLineString':
            depth = 2;
            transformedGeoJson.coordinates = processCoordinates(transformedGeoJson.coordinates, depth);
            break;
          case 'MultiPolygon':
            depth = 3;
            transformedGeoJson.coordinates = processCoordinates(transformedGeoJson.coordinates, depth);
            break;
        }

        // Remove the CRS from the GeoJSON as Leaflet expects WGS84
        delete transformedGeoJson.crs;

        return transformedGeoJson;
      }

      return geoJson;
    } catch (error) {
      console.error('Error transforming GeoJSON:', error);
      return geoJson; // Return original if transformation fails
    }
  };

  const initializeMap = () => {
    if (typeof window !== 'undefined' && window.L && mapContainer.value && !map) {
      map = window.L.map(mapContainer.value).setView([42.5, -7.5], 8); // Default view centered on Galicia
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Setup projections for coordinate transformations
      setupProjections();
    }
  };

  const loadMapScript = () => {
    if (document.getElementById('leaflet-script')) return; // Already loaded or loading

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.id = 'leaflet-script';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      nextTick(initializeMap);
    };
    document.head.appendChild(script);
  };

  const resetMapView = () => {
    if (map) {
      map.setView([42.5, -7.5], 8); // Reset to Galicia view
    }
  };

  const addQueryResultsToMap = (results) => {
    if (!map || !results || results.length === 0) return;

    console.log('Adding results to map:', results);

    // Clear previous results
    map.eachLayer(layer => {
      if (layer.options && layer.options.isQueryResult) {
        map.removeLayer(layer);
      }
    });

    // Bounds to fit all geometries
    const bounds = window.L.latLngBounds([]);
    let featuresAdded = false;

    // Add new results, using the index to assign a unique color
    results.forEach((result, index) => {
      // *** MODIFICATION START ***
      // Select a color from the palette based on the result's index.
      // The modulo operator (%) makes the colors loop if there are more results than colors.
      const featureColor = colorPalette[index % colorPalette.length];
      // *** MODIFICATION END ***

      // First check for the new geom property (GeoJSON)
      if (result.geom) {
        try {
          // Parse the geometry
          const geoJson = parseGeometry(result.geom);

          if (geoJson) {
            // Transform coordinates to WGS84 if needed
            const transformedGeoJson = transformGeoJson(geoJson);

            if (transformedGeoJson) {
              // Create a layer from the geometry
              const layer = window.L.geoJSON(transformedGeoJson, {
                // *** MODIFICATION: Use the calculated color ***
                style: {
                  color: featureColor,
                  fillColor: featureColor,
                  fillOpacity: 0.6,
                  weight: 2
                },
                isQueryResult: true,
                pointToLayer: (feature, latlng) => {
                  // *** MODIFICATION: Use the calculated color for points too ***
                  return window.L.circleMarker(latlng, {
                    radius: 8,
                    color: featureColor,
                    fillColor: featureColor,
                    fillOpacity: 0.6,
                    weight: 2,
                    isQueryResult: true
                  });
                }
              }).addTo(map);

              // Create a popup with result data
              let popupContent = '<div class="text-sm">';

              // Include provincia if available
              if (result.provincia) {
                popupContent += `<strong>${t('query.provincia')}:</strong> ${result.provincia}<br>`;
              }

              // Include num_concellos if available
              if (result.num_concellos) {
                popupContent += `<strong>${t('query.num_concellos')}:</strong> ${result.num_concellos}<br>`;
              }

              // Add other properties
              Object.keys(result).forEach(key => {
                if (key !== 'geom' && key !== 'provincia' && key !== 'num_concellos') {
                  popupContent += `<strong>${key}:</strong> ${result[key]}<br>`;
                }
              });

              popupContent += '</div>';

              // Bind the popup to the layer
              layer.bindPopup(popupContent);

              // Extend bounds to include this geometry
              if (layer.getBounds) {
                bounds.extend(layer.getBounds());
                featuresAdded = true;
              }
            }
          }
        } catch (error) {
          console.error('Error adding geometry to map:', error);
        }
      }
      // Fallback to the old lat/lng approach if geom is not available
      else if (result.lat && result.lng) {
        // *** MODIFICATION: Use the calculated color for the fallback marker ***
        const marker = window.L.circleMarker([result.lat, result.lng], {
          color: featureColor,
          fillColor: featureColor,
          fillOpacity: 0.6,
          radius: 8,
          weight: 2,
          isQueryResult: true
        }).addTo(map).bindPopup(`
          <div class="text-sm">
            <strong>${t('query.queryResultPopupTitle')}</strong><br>
            ${result.data || JSON.stringify(result)}
          </div>
        `);

        bounds.extend(marker.getLatLng());
        featuresAdded = true;
      }
    });

    // Fit the map to the bounds of all added features
    if (featuresAdded) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  onMounted(loadMapScript);

  return {
    mapContainer,
    resetMapView,
    addQueryResultsToMap,
  };
}