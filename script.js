class RouteGenerator {
  constructor() {
    // Debug flag
    this.debug = false;

    // Add panel state tracking
    this.panelStates = {
      controls: false,
      routeSelection: false,
    };

    // Add mobile breakpoint
    this.MOBILE_BREAKPOINT = 768; // pixels

    // Configuration object for all layout and styling values
    this.config = {
      // Panel dimensions
      panel: {
        width: 320,
        offset: 10,
        extraPadding: 60,
      },
      // Map padding
      padding: {
        top: 50,
        bottom: 50,
        right: 50,
      },
      // Route styling
      route: {
        selected: {
          color: '#c62828',
          width: 6,
          borderWidth: 12,
          opacity: 1,
        },
        unselected: {
          color: '#6d6d6d',
          hoverColor: '#383838',
          width: 5,
          borderWidth: 10,
          opacity: 0.6,
        },
        border: {
          color: '#ffffff',
        },
      },
    };

    // Calculate derived values
    this.config.padding.left =
      this.config.panel.width + this.config.panel.extraPadding;
    this.config.map = {
      offset: [-(this.config.panel.width + this.config.panel.offset) / 2, 0],
    };

    this.MAPBOX_API_KEY =
      'pk.eyJ1IjoidGRyYXlzb24iLCJhIjoiY201MnFqNDdyMmYxdzJqcXd2djF6d3p1aCJ9.pfeIgg_H8Bd0cLOx4NVU9g';
    this.map = null;
    this.userMarker = null;
    this.destinationMarker = null;
    this.routeSource = null;
    this.isochroneSource = null;
    this.currentLocation = null;
    this.debounceTimer = null;
    this.selectedIndex = -1;
    this.autocompleteResults = [];
    this.endLocation = null;
    this.endDebounceTimer = null;
    this.endSelectedIndex = -1;
    this.endAutocompleteResults = [];
    this.isStartMarkerMode = false;
    this.isEndMarkerMode = false;

    // Bind methods to this instance
    this.handleAutocomplete = this.handleAutocomplete.bind(this);
    this.handleAutocompleteKeydown = this.handleAutocompleteKeydown.bind(this);
    this.getCurrentLocation = this.getCurrentLocation.bind(this);
    this.generateRoute = this.generateRoute.bind(this);
    this.handleMapClick = this.handleMapClick.bind(this);
    this.setupEventListeners = this.setupEventListeners.bind(this);

    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.initMap();
        this.setupEventListeners();
      });
    } else {
      this.initMap();
      this.setupEventListeners();
    }
  }

  setupEventListeners() {
    // Get DOM elements
    const startInput = document.getElementById('start-location');
    const endInput = document.getElementById('end-location');
    const startResults = document.getElementById('start-results');
    const endResults = document.getElementById('end-results');
    const startMarkerButton = document.getElementById('start-marker-button');
    const endMarkerButton = document.getElementById('end-marker-button');
    const durationInput = document.getElementById('duration');
    const tripTypeSelect = document.getElementById('tripType');
    const generateButton = document.getElementById('generate-btn');

    // Add event listener for trip type changes
    tripTypeSelect.addEventListener('change', (e) => {
      const endLocationGroup = document.getElementById('end-location-group');
      endLocationGroup.style.display =
        e.target.value === 'oneway' ? 'block' : 'none';

      // Clear end location if switching to loop
      if (e.target.value === 'loop') {
        endInput.value = '';
        this.endLocation = null;
        if (this.destinationMarker) {
          this.destinationMarker.remove();
          this.destinationMarker = null;
        }
      }
    });

    // Add event listeners for marker buttons
    startMarkerButton.addEventListener('click', () => {
      this.isStartMarkerMode = !this.isStartMarkerMode;
      this.isEndMarkerMode = false;
      startMarkerButton.classList.toggle('active');
      endMarkerButton.classList.remove('active');
      this.map.getCanvas().style.cursor = this.isStartMarkerMode
        ? 'crosshair'
        : '';

      if (this.isStartMarkerMode) {
        this.collapsePanels();
        this.showNotification('Please click on map to set the start location');
      } else {
        this.restorePanels();
        this.hideNotification();
      }
    });

    endMarkerButton.addEventListener('click', () => {
      this.isEndMarkerMode = !this.isEndMarkerMode;
      this.isStartMarkerMode = false;
      endMarkerButton.classList.toggle('active');
      startMarkerButton.classList.remove('active');
      this.map.getCanvas().style.cursor = this.isEndMarkerMode
        ? 'crosshair'
        : '';

      if (this.isEndMarkerMode) {
        this.collapsePanels();
        this.showNotification('Please click on map to set the end location');
      } else {
        this.restorePanels();
        this.hideNotification();
      }
    });

    // Add map click event listener
    this.map.on('click', this.handleMapClick);

    // Add event listeners for autocomplete
    startInput.addEventListener('input', () => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.handleAutocomplete(startInput.value, startResults);
      }, 300);
    });

    startInput.addEventListener('keydown', (event) => {
      this.handleAutocompleteKeydown(
        event,
        startResults,
        startInput,
        'selectedIndex',
        'autocompleteResults',
        'currentLocation',
      );
    });

    endInput.addEventListener('input', () => {
      clearTimeout(this.endDebounceTimer);
      this.endDebounceTimer = setTimeout(() => {
        this.handleAutocomplete(endInput.value, endResults, true);
      }, 300);
    });

    endInput.addEventListener('keydown', (event) => {
      this.handleAutocompleteKeydown(
        event,
        endResults,
        endInput,
        'endSelectedIndex',
        'endAutocompleteResults',
        'endLocation',
      );
    });

    // Add event listener for generate button
    generateButton.addEventListener('click', () => {
      const duration = parseInt(durationInput.value);
      const isRoundTrip = tripTypeSelect.value === 'round';
      this.generateRoute(duration, isRoundTrip);
    });
  }

  // Add new method to handle trip type display updates
  updateTripTypeDisplay(tripType) {
    const endLocationGroup = document.getElementById('end-location-group');
    endLocationGroup.style.display = tripType === 'oneway' ? 'block' : 'none';

    // Clear end location if switching to loop
    if (tripType === 'loop') {
      const endLocationInput = document.getElementById('end-location');
      endLocationInput.value = '';
      this.endLocation = null;
      if (this.destinationMarker) {
        this.destinationMarker.remove();
        this.destinationMarker = null;
      }
    }
  }

  showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }

  async searchLocations(query) {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query,
        )}.json?access_token=${
          this.MAPBOX_API_KEY
        }&types=address,place,poi&limit=5`,
      );

      if (!response.ok) {
        throw new Error('Geocoding API error');
      }

      const data = await response.json();
      return data.features || [];
    } catch (error) {
      console.error('Error fetching autocomplete results:', error);
      return [];
    }
  }

  updateAutocompleteResults(results, resultsContainer, isEnd = false) {
    resultsContainer.innerHTML = '';

    results.forEach((result, index) => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.setAttribute('role', 'option');
      div.setAttribute(
        'aria-selected',
        index === (isEnd ? this.endSelectedIndex : this.selectedIndex)
          ? 'true'
          : 'false',
      );
      div.setAttribute(
        'id',
        `${isEnd ? 'end' : 'start'}-location-option-${index}`,
      );
      if (index === (isEnd ? this.endSelectedIndex : this.selectedIndex)) {
        div.className += ' selected';
      }
      div.textContent = result.place_name;

      div.addEventListener('click', () => {
        if (isEnd) {
          this.selectEndLocation(result);
        } else {
          this.selectLocation(result);
        }
      });

      resultsContainer.appendChild(div);
    });

    resultsContainer.style.display = results.length > 0 ? 'block' : 'none';

    // Update ARIA attributes
    const input = document.getElementById(
      isEnd ? 'end-location' : 'start-location',
    );
    if (results.length > 0) {
      input.setAttribute('aria-expanded', 'true');
      input.setAttribute(
        'aria-activedescendant',
        (isEnd ? this.endSelectedIndex : this.selectedIndex) >= 0
          ? `${isEnd ? 'end' : 'start'}-location-option-${
              isEnd ? this.endSelectedIndex : this.selectedIndex
            }`
          : '',
      );
    } else {
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
  }

  selectLocation(location) {
    const input = document.getElementById('start-location');
    input.value = location.place_name;
    document.getElementById('start-results').style.display = 'none';
    this.currentLocation = location.geometry.coordinates;
    this.updateUserMarker(this.currentLocation);
  }

  handleAutocomplete(query, resultsContainer, isEnd = false) {
    if (query.length < 3) {
      resultsContainer.style.display = 'none';
      return;
    }

    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      const results = await this.searchLocations(query);
      if (isEnd) {
        this.endAutocompleteResults = results;
        this.endSelectedIndex = -1;
      } else {
        this.autocompleteResults = results;
        this.selectedIndex = -1;
      }
      this.updateAutocompleteResults(results, resultsContainer, isEnd);
    }, 300);
  }

  handleAutocompleteKeydown(
    event,
    resultsContainer,
    input,
    selectedIndexProp,
    resultsProp,
    locationProp,
  ) {
    if (
      !this[resultsProp].length ||
      resultsContainer.style.display === 'none'
    ) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this[selectedIndexProp] = Math.min(
          this[selectedIndexProp] + 1,
          this[resultsProp].length - 1,
        );
        this.updateAutocompleteResults(
          this[resultsProp],
          resultsContainer,
          selectedIndexProp === 'endSelectedIndex',
        );
        break;

      case 'ArrowUp':
        event.preventDefault();
        this[selectedIndexProp] = Math.max(this[selectedIndexProp] - 1, -1);
        this.updateAutocompleteResults(
          this[resultsProp],
          resultsContainer,
          selectedIndexProp === 'endSelectedIndex',
        );
        break;

      case 'Enter':
        event.preventDefault();
        if (this[selectedIndexProp] >= 0) {
          if (selectedIndexProp === 'endSelectedIndex') {
            this.selectEndLocation(this[resultsProp][this[selectedIndexProp]]);
          } else {
            this.selectLocation(this[resultsProp][this[selectedIndexProp]]);
          }
        }
        break;

      case 'Escape':
        resultsContainer.style.display = 'none';
        this[selectedIndexProp] = -1;
        break;
    }
  }

  initMap() {
    mapboxgl.accessToken = this.MAPBOX_API_KEY;
    this.map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [-0.1276, 51.5074],
      zoom: 12,
    });

    this.map.on('load', () => {
      // Source for all attempted routes
      this.map.addSource('attempted-routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Source for waypoints
      this.map.addSource('waypoints', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Regular route source
      this.map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Add a white border to make the gap more visible
      this.map.addLayer({
        id: 'route-border',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': 12,
        },
      });

      // Regular route layer with solid line
      this.map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#c62828',
          'line-width': 6,
        },
      });

      // Add direction arrows for attempted routes (unselected)
      this.map.addLayer({
        id: 'route-arrows-unselected',
        type: 'symbol',
        source: 'attempted-routes',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 100,
          'icon-image': 'triangle-11',
          'icon-size': 0.8,
          'icon-rotate': 90,
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-padding': 0,
        },
        paint: {
          'icon-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.8,
            0.4,
          ],
          'icon-color': this.config.route.unselected.color,
        },
        filter: ['!=', ['get', 'selected'], true],
      });

      // Layer for unselected routes border
      this.map.addLayer({
        id: 'attempted-routes-border-unselected',
        type: 'line',
        source: 'attempted-routes',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': this.config.route.border.color,
          'line-width': this.config.route.unselected.borderWidth,
          'line-opacity': this.config.route.unselected.opacity,
        },
        filter: ['!=', ['get', 'selected'], true],
      });

      // Layer for unselected routes
      this.map.addLayer({
        id: 'attempted-routes-unselected',
        type: 'line',
        source: 'attempted-routes',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            this.config.route.unselected.hoverColor,
            this.config.route.unselected.color,
          ],
          'line-width': this.config.route.unselected.width,
          'line-opacity': this.config.route.unselected.opacity,
        },
        filter: ['!=', ['get', 'selected'], true],
      });

      // Layer for selected route border (on top)
      this.map.addLayer({
        id: 'attempted-routes-border-selected',
        type: 'line',
        source: 'attempted-routes',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': this.config.route.border.color,
          'line-width': this.config.route.selected.borderWidth,
          'line-opacity': this.config.route.selected.opacity,
        },
        filter: ['==', ['get', 'selected'], true],
      });

      // Layer for selected route (on top)
      this.map.addLayer({
        id: 'attempted-routes-selected',
        type: 'line',
        source: 'attempted-routes',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': this.config.route.selected.color,
          'line-width': this.config.route.selected.width,
          'line-opacity': this.config.route.selected.opacity,
        },
        filter: ['==', ['get', 'selected'], true],
      });

      // Add direction arrows for selected route
      this.map.addLayer({
        id: 'route-arrows-selected',
        type: 'symbol',
        source: 'attempted-routes',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 100,
          'icon-image': 'triangle-11',
          'icon-size': 1,
          'icon-rotate': 90,
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-padding': 0,
        },
        paint: {
          'icon-opacity': 1,
          'icon-color': this.config.route.selected.color,
        },
        filter: ['==', ['get', 'selected'], true],
      });

      // Add click interaction for routes
      this.map.on('click', 'attempted-routes-unselected', (e) => {
        if (e.features.length > 0) {
          const clickedRouteId = e.features[0].id;
          const routeOptions = document.querySelectorAll('.route-option');
          if (routeOptions && routeOptions.length > clickedRouteId) {
            routeOptions[clickedRouteId].click();
          }
        }
      });

      // Change cursor on hover
      this.map.on('mouseenter', 'attempted-routes-unselected', () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });

      this.map.on('mouseleave', 'attempted-routes-unselected', () => {
        this.map.getCanvas().style.cursor = '';
      });

      // Update waypoints layer with larger circles and labels
      this.map.addLayer({
        id: 'waypoints',
        type: 'circle',
        source: 'waypoints',
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Add labels for waypoints
      this.map.addLayer({
        id: 'waypoint-labels',
        type: 'symbol',
        source: 'waypoints',
        layout: {
          'text-field': [
            'number-format',
            ['get', 'index'],
            { locale: 'en-US' },
          ],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 14,
          'text-offset': [0, -1.5],
        },
        paint: {
          'text-color': '#000000',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      });

      // Store references to sources
      this.routeSource = this.map.getSource('route');
      this.attemptedRoutesSource = this.map.getSource('attempted-routes');
      this.waypointsSource = this.map.getSource('waypoints');

      // Add source and layer for the isochrone
      this.map.addSource('isochrone', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      this.map.addLayer({
        id: 'isochrone',
        type: 'fill',
        source: 'isochrone',
        layout: {
          visibility: 'none', // Hide isochrone layer by default
        },
        paint: {
          'fill-color': '#FF0000',
          'fill-opacity': 0.1,
          'fill-outline-color': '#FF0000',
        },
      });

      this.isochroneSource = this.map.getSource('isochrone');
    });
  }

  processRouteForDisplay(coordinates) {
    const segments = [];

    // Process each segment
    for (let i = 0; i < coordinates.length - 1; i++) {
      const start = coordinates[i];
      const end = coordinates[i + 1];
      segments.push([start, end]);
    }

    return {
      regular: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'MultiLineString',
          coordinates: segments,
        },
      },
    };
  }

  async getCurrentLocation() {
    // Cancel marker selector mode if active
    if (this.isStartMarkerMode) {
      this.isStartMarkerMode = false;
      document.getElementById('start-marker-button').classList.remove('active');
      this.map.getCanvas().style.cursor = '';
      this.hideNotification();
    }

    if (navigator.geolocation) {
      const generateBtn = document.getElementById('generate-btn');
      generateBtn.disabled = true;

      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });

        const { latitude, longitude } = position.coords;
        this.currentLocation = [longitude, latitude];
        this.updateUserMarker(this.currentLocation);
        const address = await this.reverseGeocode(latitude, longitude);
        document.getElementById('start-location').value = address;
      } catch (error) {
        this.showError('Error getting location: ' + error.message);
      } finally {
        generateBtn.disabled = false;
      }
    } else {
      this.showError('Geolocation is not supported by this browser.');
    }
  }

  updateUserMarker(coordinates) {
    if (this.userMarker) {
      this.userMarker.remove();
    }
    this.userMarker = new mapboxgl.Marker()
      .setLngLat(coordinates)
      .addTo(this.map);
    this.map.flyTo({
      center: coordinates,
      zoom: 14,
      offset: [-180, 0], // Offset to center the point accounting for the panel with extra space
    });
  }

  async reverseGeocode(lat, lon) {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${this.MAPBOX_API_KEY}`,
      );
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        return data.features[0].place_name;
      }
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }
  }

  async getIsochrone(startCoords, activity, duration) {
    try {
      console.log('Requesting isochrone for:', startCoords, activity, duration);

      // Convert activity type to Mapbox profile
      const profile = this.getMapboxProfile(activity);

      // Convert duration from seconds to minutes for Mapbox API
      const durationMinutes = Math.round(duration / 60);

      const response = await fetch(
        `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${startCoords[0]},${startCoords[1]}?contours_minutes=${durationMinutes}&polygons=true&access_token=${this.MAPBOX_API_KEY}`,
      );

      if (!response.ok) {
        throw new Error('Failed to fetch isochrone');
      }

      const data = await response.json();
      console.log('Isochrone API response:', data);

      if (!data.features || !data.features[0] || !data.features[0].geometry) {
        throw new Error('Invalid isochrone data');
      }

      return data.features[0].geometry;
    } catch (error) {
      console.error('Error fetching isochrone:', error);
      throw error;
    }
  }

  getBoundingBox(coords) {
    return coords.reduce(
      (bounds, coord) => {
        return {
          minLon: Math.min(bounds.minLon, coord[0]),
          maxLon: Math.max(bounds.maxLon, coord[0]),
          minLat: Math.min(bounds.minLat, coord[1]),
          maxLat: Math.max(bounds.maxLat, coord[1]),
        };
      },
      {
        minLon: Infinity,
        maxLon: -Infinity,
        minLat: Infinity,
        maxLat: -Infinity,
      },
    );
  }

  isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0],
        yi = polygon[i][1];
      const xj = polygon[j][0],
        yj = polygon[j][1];

      const intersect =
        yi > point[1] !== yj > point[1] &&
        point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  getRandomPointInPolygon(polygon) {
    const bounds = this.getBoundingBox(polygon.coordinates[0]);
    let point;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      const lon =
        Math.random() * (bounds.maxLon - bounds.minLon) + bounds.minLon;
      const lat =
        Math.random() * (bounds.maxLat - bounds.minLat) + bounds.minLat;
      point = [lon, lat];
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error('Could not generate valid point in polygon');
      }
    } while (!this.isPointInPolygon(point, polygon.coordinates[0]));

    return point;
  }

  async geocode(location) {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          location,
        )}.json?access_token=${
          this.MAPBOX_API_KEY
        }&types=address,place,poi&limit=5`,
      );
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        return data.features[0].geometry.coordinates;
      }
      return null;
    } catch (error) {
      console.error('Error geocoding:', error);
      return null;
    }
  }

  // Debug visualization function
  visualizeDebugPoints(waypoints, type = 'loop') {
    if (!this.debug) return;

    let features = waypoints.map((waypoint, index) => {
      let color;
      let label = '';

      if (type === 'loop') {
        if (index === 0) {
          color = '#4CAF50'; // Start point (green)
          label = 'Start/End';
        } else if (index === 1) {
          color = '#FF9800'; // Outward point (orange)
          label = 'Outward';
        } else if (index === waypoints.length - 1) {
          color = '#4CAF50'; // End point (same as start for loop)
          label = 'Start/End';
        } else {
          color = '#2196F3'; // Return points (blue)
          label = 'Return';
        }
      } else if (type === 'oneway') {
        if (index === 0) {
          color = '#4CAF50'; // Start point (green)
          label = 'Start';
        } else if (index === waypoints.length - 1) {
          color = '#FF6B6B'; // End point (red)
          label = 'End';
        } else {
          color = '#2196F3'; // Intermediate points (blue)
          label = 'Via';
        }
      }

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: waypoint,
        },
        properties: {
          color: color,
          index: index + 1,
          label: label,
        },
      };
    });

    this.waypointsSource.setData({
      type: 'FeatureCollection',
      features: features,
    });
  }

  async generateWaypoints(startCoords, activity, duration, tripType) {
    try {
      console.log('Generating waypoints for duration:', duration);

      // Helper function to generate forward waypoints using isochrone
      const generateForwardWaypoints = async (center, duration, numPoints) => {
        // Get isochrone for outward point (using 1/3 of total duration)
        const outwardIsochrone = await this.getIsochrone(
          center,
          activity,
          duration / 3,
        );

        const points = [];
        // Generate multiple points along the isochrone boundary
        for (let i = 0; i < numPoints; i++) {
          try {
            const point = this.getRandomPointInPolygon(outwardIsochrone);
            points.push(point);
          } catch (error) {
            console.log('Error generating point:', error);
          }
        }
        return points;
      };

      // Helper function to generate return waypoints using isochrones
      const generateReturnWaypoints = async (
        outwardPoint,
        startPoint,
        numPoints,
        remainingDuration,
      ) => {
        // Get isochrones for both outward point and start point
        const [outwardIsochrone, startIsochrone] = await Promise.all([
          this.getIsochrone(outwardPoint, activity, remainingDuration / 2),
          this.getIsochrone(startPoint, activity, remainingDuration / 2),
        ]);

        const points = [];
        // Find points in the overlapping region of both isochrones
        for (let i = 0; i < numPoints; i++) {
          let attempts = 0;
          const maxAttempts = 10;

          while (attempts < maxAttempts) {
            try {
              // Try to find a point in the first isochrone
              const point = this.getRandomPointInPolygon(outwardIsochrone);
              // Check if it's also in the second isochrone
              if (this.isPointInPolygon(point, startIsochrone.coordinates[0])) {
                points.push(point);
                break;
              }
            } catch (error) {
              console.log('Error generating return point:', error);
            }
            attempts++;
          }
        }
        return points;
      };

      const allRoutes = [];
      const maxAttempts = 3; // Limit to 3 API calls

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          // Generate outward points
          const outwardPoints = await generateForwardWaypoints(
            startCoords,
            duration,
            3, // Generate 3 potential points
          );

          if (outwardPoints.length === 0) {
            throw new Error('No valid outward points generated');
          }

          // Randomly select one of the outward points
          const outwardPoint =
            outwardPoints[Math.floor(Math.random() * outwardPoints.length)];

          // Calculate remaining duration after reaching outward point
          const outwardRoute = await this.getRoute(
            [startCoords, outwardPoint],
            activity,
            'loop',
          );
          const remainingDuration = duration - outwardRoute.summary.duration;

          // Generate return waypoints
          const returnPoints = await generateReturnWaypoints(
            outwardPoint,
            startCoords,
            2, // Use 2 points for the return journey
            remainingDuration,
          );

          if (returnPoints.length < 2) {
            throw new Error('Not enough valid return points generated');
          }

          // Combine into final route waypoints
          const waypoints = [
            startCoords,
            outwardPoint,
            ...returnPoints,
            startCoords,
          ];

          // Visualize waypoints for debugging
          this.visualizeDebugPoints(waypoints);

          const route = await this.getRoute(waypoints, activity, 'loop');

          // Validate route duration is within acceptable range (0.8 - 1.2 of target)
          const minDuration = duration * 0.8;
          const maxDuration = duration * 1.2;
          if (
            route.summary.duration >= minDuration &&
            route.summary.duration <= maxDuration
          ) {
            allRoutes.push({
              ...route,
              waypoints,
            });
          }
        } catch (error) {
          console.log(`Attempt ${attempt + 1} failed:`, error);
        }
      }

      if (allRoutes.length === 0) {
        throw new Error('Could not generate any suitable routes');
      }

      // Sort routes by duration (prefer shorter routes that meet minimum)
      allRoutes.sort((a, b) => a.summary.duration - b.summary.duration);

      const topRoutes = allRoutes.slice(0, 3);
      this.displayRouteOptions(topRoutes);

      this.attemptedRoutesSource.setData({
        type: 'FeatureCollection',
        features: topRoutes.map((route, index) => ({
          type: 'Feature',
          id: index,
          properties: {
            selected: index === 0,
          },
          geometry: route.geometry,
        })),
      });

      this.routeSource.setData({
        type: 'FeatureCollection',
        features: [],
      });

      this.selectRoute(topRoutes, 0);
      return topRoutes[0].waypoints;
    } catch (error) {
      console.error('Error generating waypoints:', error);
      throw error;
    }
  }

  calculateWaypoints(duration) {
    // 1 waypoint per 15 minutes (900 seconds)
    const timePerWaypoint = 30 * 60; // 15 minutes in seconds
    const numWaypoints = Math.floor(duration / timePerWaypoint);

    // Ensure at least 2 waypoints and no more than 5
    return Math.min(Math.max(2, numWaypoints), 5);
  }

  async getRoute(waypoints, activity, tripType, options = {}) {
    try {
      console.log('Requesting route with waypoints:', waypoints);

      // Convert activity type to Mapbox profile
      const profile = this.getMapboxProfile(activity);

      // Format coordinates for Mapbox Directions API
      const coordinates = waypoints.map((coord) => coord.join(',')).join(';');

      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?access_token=${
          this.MAPBOX_API_KEY
        }&geometries=geojson&overview=full&alternatives=${
          options.alternative_routes ? 'true' : 'false'
        }&continue_straight=${tripType === 'oneway'}`,
      );

      if (!response.ok) {
        throw new Error('Failed to get route');
      }

      const data = await response.json();
      console.log('Route API response:', data);

      if (!data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }

      // Convert Mapbox response to our format
      const mainRoute = {
        geometry: data.routes[0].geometry,
        summary: {
          distance: data.routes[0].distance,
          duration: data.routes[0].duration,
        },
        waypoints: waypoints,
      };

      if (data.routes.length > 1) {
        mainRoute.alternatives = data.routes.slice(1).map((route) => ({
          geometry: route.geometry,
          summary: {
            distance: route.distance,
            duration: route.duration,
          },
          waypoints: waypoints,
        }));
      }

      return mainRoute;
    } catch (error) {
      console.error('Error getting route:', error);
      throw error;
    }
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  formatDistance(meters, unit = 'mi') {
    if (unit === 'km') {
      if (meters >= 1000) {
        return `${(meters / 1000).toFixed(1)} km`;
      }
      return `${Math.round(meters)} m`;
    } else {
      const miles = meters * 0.000621371;
      if (miles >= 1) {
        return `${miles.toFixed(1)} miles`;
      }
      return `${(miles * 5280).toFixed(0)} feet`;
    }
  }

  async generateRoute() {
    const loading = document.getElementById('loading');
    const generateBtn = document.getElementById('generate-btn');
    loading.style.display = 'block';
    generateBtn.disabled = true;

    try {
      // Clear previous routes and waypoints
      this.attemptedRoutesSource.setData({
        type: 'FeatureCollection',
        features: [],
      });
      this.waypointsSource.setData({
        type: 'FeatureCollection',
        features: [],
      });

      // Clear previous markers
      if (this.userMarker) {
        this.userMarker.remove();
      }
      if (this.destinationMarker) {
        this.destinationMarker.remove();
      }

      const locationInput = document.getElementById('start-location').value;
      if (locationInput.length < 3) {
        throw new Error('Please enter a valid location');
      }
      const startCoords =
        this.currentLocation || (await this.geocode(locationInput));
      if (!startCoords) {
        throw new Error('Could not find start location');
      }

      // Add start marker
      this.updateUserMarker(startCoords);

      const activity = document.getElementById('activity').value;
      const duration = parseInt(document.getElementById('duration').value) * 60; // Convert to seconds
      const tripType = document.getElementById('tripType').value;

      let waypoints;
      if (tripType === 'oneway') {
        const endLocationInput = document.getElementById('end-location').value;
        const endCoords =
          this.endLocation || (await this.geocode(endLocationInput));
        if (!endCoords) {
          throw new Error('Could not find end location');
        }
        // Add destination marker for one-way trips
        this.updateDestinationMarker(endCoords);

        waypoints = await this.generateOneWayWaypoints(
          startCoords,
          endCoords,
          activity,
          duration,
        );
      } else {
        waypoints = await this.generateWaypoints(
          startCoords,
          activity,
          duration,
          tripType,
        );
      }

      console.log('Final waypoints:', waypoints);

      const route = await this.getRoute(waypoints, activity);
      console.log('Final route:', route);

      if (!route.geometry || !route.geometry.coordinates) {
        throw new Error('Invalid route data');
      }

      // Fit map to route bounds
      const coordinates = route.geometry.coordinates;
      if (coordinates && coordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach((coord) => {
          bounds.extend(coord);
        });
        this.map.fitBounds(bounds, {
          padding: {
            top: this.config.padding.top,
            bottom: this.config.padding.bottom,
            left: this.config.padding.left,
            right: this.config.padding.right,
          },
        });
      }
    } catch (error) {
      console.error('Error generating route:', error);
      this.showError(
        error.message || 'Error generating route. Please try again.',
      );

      // Clear the isochrone and route if there's an error
      this.routeSource.setData({
        type: 'FeatureCollection',
        features: [],
      });
      this.isochroneSource.setData({
        type: 'FeatureCollection',
        features: [],
      });
    } finally {
      loading.style.display = 'none';
      generateBtn.disabled = false;
    }
  }

  async handleEndLocationAutocomplete() {
    const input = document.getElementById('end-location');
    const query = input.value.trim();

    if (query.length < 3) {
      document.getElementById('end-autocomplete-results').style.display =
        'none';
      return;
    }

    clearTimeout(this.endDebounceTimer);
    this.endDebounceTimer = setTimeout(async () => {
      this.endAutocompleteResults = await this.searchLocations(query);
      this.endSelectedIndex = -1;
      this.updateEndAutocompleteResults(this.endAutocompleteResults);
    }, 300);
  }

  updateEndAutocompleteResults(results) {
    const resultsContainer = document.getElementById(
      'end-autocomplete-results',
    );
    resultsContainer.innerHTML = '';

    results.forEach((result, index) => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.setAttribute('role', 'option');
      div.setAttribute(
        'aria-selected',
        index === this.endSelectedIndex ? 'true' : 'false',
      );
      div.setAttribute('id', `end-location-option-${index}`);
      if (index === this.endSelectedIndex) {
        div.className += ' selected';
      }
      div.textContent = result.properties.label;

      div.addEventListener('click', () => {
        this.selectEndLocation(result);
      });

      resultsContainer.appendChild(div);
    });

    resultsContainer.style.display = results.length > 0 ? 'block' : 'none';

    // Update ARIA attributes
    const input = document.getElementById('end-location');
    if (results.length > 0) {
      input.setAttribute('aria-expanded', 'true');
      input.setAttribute(
        'aria-activedescendant',
        this.endSelectedIndex >= 0
          ? `end-location-option-${this.endSelectedIndex}`
          : '',
      );
    } else {
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
  }

  selectEndLocation(location) {
    const input = document.getElementById('end-location');
    input.value = location.place_name;
    document.getElementById('end-results').style.display = 'none';
    this.endLocation = location.geometry.coordinates;
    this.updateDestinationMarker(this.endLocation);
  }

  updateDestinationMarker(coordinates) {
    if (this.destinationMarker) {
      this.destinationMarker.remove();
    }
    this.destinationMarker = new mapboxgl.Marker({ color: '#FF6B6B' })
      .setLngLat(coordinates)
      .addTo(this.map);

    // Adjust map to show both markers
    if (this.currentLocation) {
      const bounds = new mapboxgl.LngLatBounds()
        .extend(this.currentLocation)
        .extend(coordinates);
      this.map.fitBounds(bounds, {
        padding: {
          top: 50,
          bottom: 50,
          left: 340,
          right: 50,
        },
      });
    } else {
      this.map.flyTo({
        center: coordinates,
        zoom: 14,
        offset: this.config.map.offset,
      });
    }
  }

  findCenterOfOverlap(polygon1, polygon2) {
    // Find points that are in both polygons
    const points = [];
    const coords1 = polygon1.coordinates[0];
    const step = 0.001; // Adjust grid density as needed

    const bounds = {
      minLon: Math.max(
        this.getBoundingBox(coords1).minLon,
        this.getBoundingBox(polygon2.coordinates[0]).minLon,
      ),
      maxLon: Math.min(
        this.getBoundingBox(coords1).maxLon,
        this.getBoundingBox(polygon2.coordinates[0]).maxLon,
      ),
      minLat: Math.max(
        this.getBoundingBox(coords1).minLat,
        this.getBoundingBox(polygon2.coordinates[0]).minLat,
      ),
      maxLat: Math.min(
        this.getBoundingBox(coords1).maxLat,
        this.getBoundingBox(polygon2.coordinates[0]).maxLat,
      ),
    };

    for (let lon = bounds.minLon; lon <= bounds.maxLon; lon += step) {
      for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += step) {
        const point = [lon, lat];
        if (
          this.isPointInPolygon(point, coords1) &&
          this.isPointInPolygon(point, polygon2.coordinates[0])
        ) {
          points.push(point);
        }
      }
    }

    if (points.length === 0) {
      return null;
    }

    // Calculate center of overlapping points
    const center = points.reduce(
      (acc, point) => {
        return [acc[0] + point[0], acc[1] + point[1]];
      },
      [0, 0],
    );

    return [center[0] / points.length, center[1] / points.length];
  }

  findLateralPoint(center, polygon1, polygon2, bearing) {
    const step = 0.001; // Step size for moving laterally
    const maxSteps = 100; // Maximum number of steps to try
    let point = center;

    for (let i = 0; i < maxSteps; i++) {
      // Calculate new point at given bearing
      const newPoint = this.movePoint(point, bearing, step);

      // Check if point is still in both polygons
      if (
        this.isPointInPolygon(newPoint, polygon1.coordinates[0]) &&
        this.isPointInPolygon(newPoint, polygon2.coordinates[0])
      ) {
        point = newPoint;
      } else {
        break;
      }
    }

    return point;
  }

  movePoint(point, bearing, distance) {
    const R = 6371000; // Earth's radius in meters
    const lat1 = (point[1] * Math.PI) / 180;
    const lon1 = (point[0] * Math.PI) / 180;
    const brng = (bearing * Math.PI) / 180;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distance / R) +
        Math.cos(lat1) * Math.sin(distance / R) * Math.cos(brng),
    );

    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(brng) * Math.sin(distance / R) * Math.cos(lat1),
        Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2),
      );

    return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
  }

  async generateOneWayWaypoints(startCoords, endCoords, activity, duration) {
    try {
      console.log('Generating one-way waypoints:', {
        startCoords,
        endCoords,
        duration,
      });

      // First try direct routes with alternatives
      const directRoute = await this.getRoute(
        [startCoords, endCoords],
        activity,
        'oneway',
        {
          alternative_routes: true,
        },
      );

      const directDuration = directRoute.summary.duration;

      // If direct route is longer than minimum duration, use direct routes
      if (directDuration >= duration) {
        const allDirectRoutes = [directRoute];

        if (directRoute.alternatives) {
          allDirectRoutes.push(...directRoute.alternatives);
        }

        // Sort by duration and take top 3
        allDirectRoutes.sort((a, b) => a.summary.duration - b.summary.duration);
        const topRoutes = allDirectRoutes.slice(0, 3);

        // Display and return direct routes
        this.displayRouteOptions(topRoutes);
        this.attemptedRoutesSource.setData({
          type: 'FeatureCollection',
          features: topRoutes.map((route, index) => ({
            type: 'Feature',
            id: index,
            properties: {
              selected: index === 0,
            },
            geometry: route.geometry,
          })),
        });

        this.selectRoute(topRoutes, 0);
        return topRoutes[0].waypoints;
      }

      // If direct route is too short, calculate a detour
      const remainingDuration = duration - directDuration;

      // Get isochrones for both points with remaining duration
      const [startPolygon, endPolygon] = await Promise.all([
        this.getIsochrone(startCoords, activity, remainingDuration / 2),
        this.getIsochrone(endCoords, activity, remainingDuration / 2),
      ]);

      // Find center of overlapping area
      const center = this.findCenterOfOverlap(startPolygon, endPolygon);
      if (!center) {
        throw new Error('No overlapping area found between isochrones');
      }

      const allRoutes = [];
      const bearings = [0, 90, 180, 270]; // Try different directions

      for (const bearing of bearings) {
        try {
          // Find a point laterally from the center
          const midPoint = this.findLateralPoint(
            center,
            startPolygon,
            endPolygon,
            bearing,
          );
          const waypoints = [startCoords, midPoint, endCoords];

          // Visualize waypoints for debugging
          this.visualizeDebugPoints(waypoints, 'oneway');

          const route = await this.getRoute(waypoints, activity, 'oneway');

          // Only validate minimum duration
          if (route.summary.duration >= duration) {
            allRoutes.push({
              ...route,
              waypoints,
            });
          }
        } catch (error) {
          console.log(`Attempt with bearing ${bearing} failed:`, error);
        }
      }

      if (allRoutes.length === 0) {
        throw new Error('Could not generate any suitable routes');
      }

      // Sort routes by duration (prefer shorter routes that meet minimum)
      allRoutes.sort((a, b) => a.summary.duration - b.summary.duration);

      const topRoutes = allRoutes.slice(0, 3);
      this.displayRouteOptions(topRoutes);

      this.attemptedRoutesSource.setData({
        type: 'FeatureCollection',
        features: topRoutes.map((route, index) => ({
          type: 'Feature',
          id: index,
          properties: {
            selected: index === 0,
          },
          geometry: route.geometry,
        })),
      });

      this.routeSource.setData({
        type: 'FeatureCollection',
        features: [],
      });

      this.selectRoute(topRoutes, 0);
      return topRoutes[0].waypoints;
    } catch (error) {
      console.error('Error generating one-way waypoints:', error);
      throw error;
    }
  }

  swapLocations() {
    const startInput = document.getElementById('start-location');
    const endInput = document.getElementById('end-location');

    // Swap input values
    const tempValue = startInput.value;
    startInput.value = endInput.value;
    endInput.value = tempValue;

    // Swap stored coordinates
    const tempLocation = this.currentLocation;
    this.currentLocation = this.endLocation;
    this.endLocation = tempLocation;

    // Update markers
    if (this.currentLocation) {
      this.updateUserMarker(this.currentLocation);
    }
    if (this.endLocation) {
      this.updateDestinationMarker(this.endLocation);
    }
  }

  handleEndLocationAutocompleteKeydown(event) {
    const resultsContainer = document.getElementById(
      'end-autocomplete-results',
    );

    if (
      !this.endAutocompleteResults ||
      !this.endAutocompleteResults.length ||
      resultsContainer.style.display === 'none'
    ) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.endSelectedIndex = Math.min(
          this.endSelectedIndex + 1,
          this.endAutocompleteResults.length - 1,
        );
        this.updateEndAutocompleteResults(this.endAutocompleteResults);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.endSelectedIndex = Math.max(this.endSelectedIndex - 1, -1);
        this.updateEndAutocompleteResults(this.endAutocompleteResults);
        break;

      case 'Enter':
        event.preventDefault();
        if (this.endSelectedIndex >= 0) {
          this.selectEndLocation(
            this.endAutocompleteResults[this.endSelectedIndex],
          );
        }
        break;

      case 'Escape':
        resultsContainer.style.display = 'none';
        this.endSelectedIndex = -1;
        break;
    }
  }

  displayRouteOptions(routes) {
    const routeOptionsContainer = document.getElementById('route-options');
    const routeSelectionPanel = document.getElementById(
      'route-selection-panel',
    );
    const controlsPanel = document.getElementById('controls');
    routeOptionsContainer.innerHTML = '';

    routes.forEach((route, index) => {
      const routeOption = document.createElement('div');
      routeOption.className = 'route-option' + (index === 0 ? ' selected' : '');
      routeOption.innerHTML = `
        <div>Route ${index + 1}</div>
        <div class="route-option-details">
          <span>Distance: ${this.formatDistance(route.summary.distance)}</span>
          <span>Duration: ${this.formatDuration(route.summary.duration)}</span>
        </div>
      `;

      routeOption.addEventListener('click', () =>
        this.selectRoute(routes, index),
      );
      routeOptionsContainer.appendChild(routeOption);
    });

    // Show route selection panel and conditionally collapse route settings
    routeSelectionPanel.style.display = 'block';
    routeSelectionPanel.open = true;

    // Only collapse controls panel on mobile screens
    if (this.isMobileScreen()) {
      controlsPanel.open = false;
    }
  }

  selectRoute(routes, selectedIndex) {
    // Update UI
    document.querySelectorAll('.route-option').forEach((option, index) => {
      option.className =
        'route-option' + (index === selectedIndex ? ' selected' : '');
    });

    // Update map display
    this.attemptedRoutesSource.setData({
      type: 'FeatureCollection',
      features: routes.map((route, index) => ({
        type: 'Feature',
        id: index,
        properties: {
          selected: index === selectedIndex,
        },
        geometry: route.geometry,
      })),
    });

    // Update waypoint visualization for selected route
    const selectedRoute = routes[selectedIndex];
    const isOneWay =
      selectedRoute.waypoints.length > 0 &&
      selectedRoute.waypoints[0] !==
        selectedRoute.waypoints[selectedRoute.waypoints.length - 1];
    this.visualizeDebugPoints(
      selectedRoute.waypoints,
      isOneWay ? 'oneway' : 'regular',
    );

    // Fit map to selected route bounds with asymmetric padding
    const coordinates = routes[selectedIndex].geometry.coordinates;
    if (coordinates && coordinates.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach((coord) => {
        bounds.extend(coord);
      });
      this.map.fitBounds(bounds, {
        padding: {
          top: this.config.padding.top,
          bottom: this.config.padding.bottom,
          left: this.config.padding.left,
          right: this.config.padding.right,
        },
      });
    }
  }

  async handleMapClick(event) {
    if (this.isStartMarkerMode || this.isEndMarkerMode) {
      const coordinates = [event.lngLat.lng, event.lngLat.lat];

      if (this.isStartMarkerMode) {
        this.currentLocation = coordinates;
        this.updateUserMarker(this.currentLocation);
        this.isStartMarkerMode = false;
        document
          .getElementById('start-marker-button')
          .classList.remove('active');
        this.map.getCanvas().style.cursor = '';
        this.hideNotification();
        this.restorePanels();

        // Reverse geocode and update start input
        const address = await this.reverseGeocode(
          event.lngLat.lat,
          event.lngLat.lng,
        );
        document.getElementById('start-location').value = address;
      } else if (this.isEndMarkerMode) {
        this.endLocation = coordinates;
        this.updateDestinationMarker(this.endLocation);
        this.isEndMarkerMode = false;
        document.getElementById('end-marker-button').classList.remove('active');
        this.map.getCanvas().style.cursor = '';
        this.hideNotification();
        this.restorePanels();

        // Reverse geocode and update end input
        const address = await this.reverseGeocode(
          event.lngLat.lat,
          event.lngLat.lng,
        );
        document.getElementById('end-location').value = address;
      }
    }
  }

  showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
  }

  hideNotification() {
    const notification = document.getElementById('notification');
    notification.classList.remove('show');
  }

  // Add new methods for panel management
  savePanelStates() {
    const controlsPanel = document.getElementById('controls');
    const routeSelectionPanel = document.getElementById(
      'route-selection-panel',
    );

    this.panelStates.controls = controlsPanel.open;
    this.panelStates.routeSelection = routeSelectionPanel.open;
  }

  collapsePanels() {
    this.savePanelStates();

    const controlsPanel = document.getElementById('controls');
    const routeSelectionPanel = document.getElementById(
      'route-selection-panel',
    );

    controlsPanel.open = false;
    routeSelectionPanel.open = false;
  }

  restorePanels() {
    const controlsPanel = document.getElementById('controls');
    const routeSelectionPanel = document.getElementById(
      'route-selection-panel',
    );

    controlsPanel.open = this.panelStates.controls;
    routeSelectionPanel.open = this.panelStates.routeSelection;
  }

  // Add method to check if screen is mobile
  isMobileScreen() {
    return window.innerWidth < this.MOBILE_BREAKPOINT;
  }

  // Helper method to convert activity type to Mapbox profile
  getMapboxProfile(activity) {
    switch (activity) {
      case 'foot-walking':
        return 'walking';
      case 'foot-hiking':
        return 'walking';
      case 'cycling-regular':
        return 'cycling';
      default:
        return 'walking';
    }
  }
}

// Create instance and expose necessary methods globally
const routeGenerator = new RouteGenerator();

// For backward compatibility with onclick handlers in HTML
window.getCurrentLocation = () => routeGenerator.getCurrentLocation();
window.generateRoute = () => routeGenerator.generateRoute();
window.swapLocations = () => routeGenerator.swapLocations();
