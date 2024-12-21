class RouteGenerator {
  constructor() {
    // Debug flag
    this.debug = true;

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

    this.ORS_API_KEY =
      '5b3ce3597851110001cf62487839740366424bf58852b11aadebd3a7';
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

      // Clear end location if switching to round trip
      if (e.target.value === 'round') {
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
        this.showNotification('Please click on map to set the start location');
      } else {
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
        this.showNotification('Please click on map to set the end location');
      } else {
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

    // Clear end location if switching to round trip
    if (tripType === 'round') {
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
        `https://api.openrouteservice.org/geocode/autocomplete?api_key=${
          this.ORS_API_KEY
        }&text=${encodeURIComponent(query)}`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
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

  updateAutocompleteResults(results) {
    const resultsContainer = document.getElementById('autocomplete-results');
    resultsContainer.innerHTML = '';

    results.forEach((result, index) => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.setAttribute('role', 'option');
      div.setAttribute(
        'aria-selected',
        index === this.selectedIndex ? 'true' : 'false',
      );
      div.setAttribute('id', `location-option-${index}`);
      if (index === this.selectedIndex) {
        div.className += ' selected';
      }
      div.textContent = result.properties.label;

      div.addEventListener('click', () => {
        this.selectLocation(result);
      });

      resultsContainer.appendChild(div);
    });

    resultsContainer.style.display = results.length > 0 ? 'block' : 'none';

    // Update ARIA attributes
    const input = document.getElementById('location');
    if (results.length > 0) {
      input.setAttribute('aria-expanded', 'true');
      input.setAttribute(
        'aria-activedescendant',
        this.selectedIndex >= 0 ? `location-option-${this.selectedIndex}` : '',
      );
    } else {
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
  }

  selectLocation(location) {
    const input = document.getElementById('start-location');
    input.value = location.properties.label;
    document.getElementById('start-results').style.display = 'none';
    this.currentLocation = location.geometry.coordinates;
    this.updateUserMarker(this.currentLocation);
  }

  handleAutocomplete() {
    const input = document.getElementById('start-location');
    const query = input.value.trim();

    if (query.length < 3) {
      document.getElementById('start-results').style.display = 'none';
      return;
    }

    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      this.autocompleteResults = await this.searchLocations(query);
      this.selectedIndex = -1;
      this.updateAutocompleteResults(this.autocompleteResults);
    }, 300);
  }

  handleAutocompleteKeydown(event) {
    const resultsContainer = document.getElementById('autocomplete-results');

    if (
      !this.autocompleteResults.length ||
      resultsContainer.style.display === 'none'
    ) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          this.autocompleteResults.length - 1,
        );
        this.updateAutocompleteResults(this.autocompleteResults);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.updateAutocompleteResults(this.autocompleteResults);
        break;

      case 'Enter':
        event.preventDefault();
        if (this.selectedIndex >= 0) {
          this.selectLocation(this.autocompleteResults[this.selectedIndex]);
        }
        break;

      case 'Escape':
        resultsContainer.style.display = 'none';
        this.selectedIndex = -1;
        break;
    }
  }

  initMap() {
    this.map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
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

      // Layer for waypoints
      this.map.addLayer({
        id: 'waypoints',
        type: 'circle',
        source: 'waypoints',
        paint: {
          'circle-radius': 6,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
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
    this.userMarker = new maplibregl.Marker()
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
        `https://api.openrouteservice.org/geocode/reverse?api_key=${this.ORS_API_KEY}&point.lon=${lon}&point.lat=${lat}`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
      );
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        return data.features[0].properties.label;
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
      const response = await fetch(
        `https://api.openrouteservice.org/v2/isochrones/${activity}/geojson`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.ORS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            locations: [startCoords],
            range: [duration],
            location_type: 'start',
            range_type: 'time',
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'Failed to fetch isochrone');
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
        `https://api.openrouteservice.org/geocode/search?api_key=${
          this.ORS_API_KEY
        }&text=${encodeURIComponent(location)}`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
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
  visualizeDebugPoints(waypoints, type = 'regular') {
    if (!this.debug) return;

    let features = waypoints.map((waypoint, index) => {
      let color;
      if (type === 'regular') {
        color = index === 0 ? '#4CAF50' : '#FF9800';
      } else if (type === 'oneway') {
        color =
          index === 0
            ? '#4CAF50'
            : index === waypoints.length - 1
            ? '#FF6B6B'
            : '#FF9800';
      }

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: waypoint,
        },
        properties: {
          color: color,
          index: index,
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

      // For round trips, we want to get back to start, so use half duration for outward journey
      const isochroneDuration = duration / 2;
      const polygon = await this.getIsochrone(
        startCoords,
        activity,
        isochroneDuration,
      );

      const numWaypoints = this.calculateWaypoints(duration);
      console.log('Calculated waypoints:', numWaypoints);

      const maxAttempts = 10;
      const allRoutes = [];

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const waypoints = [startCoords];
          let lastPoint = startCoords;
          let remainingDuration = isochroneDuration;

          // Generate waypoints progressively further from the previous point
          for (let i = 0; i < numWaypoints - 1; i++) {
            const progressFactor = (i + 1) / (numWaypoints - 1); // 0 to 1
            const targetDuration = remainingDuration * progressFactor;

            // Get isochrone for current point with remaining duration
            const currentIsochrone = await this.getIsochrone(
              lastPoint,
              activity,
              targetDuration,
            );

            // Find point in both the original polygon and current isochrone
            let point;
            let pointFound = false;
            let attempts = 0;
            const maxPointAttempts = 50;

            while (!pointFound && attempts < maxPointAttempts) {
              const candidatePoint =
                this.getRandomPointInPolygon(currentIsochrone);

              // Check if point is in original polygon
              if (
                this.isPointInPolygon(candidatePoint, polygon.coordinates[0])
              ) {
                point = candidatePoint;
                pointFound = true;
              }
              attempts++;
            }

            if (!pointFound) {
              console.log(
                `Attempt ${
                  attempt + 1
                }: Could not find valid point for waypoint ${i + 1}`,
              );
              break;
            }

            waypoints.push(point);
            lastPoint = point;

            // Visualize waypoints for debugging
            this.visualizeDebugPoints(waypoints);
          }

          // Add start point to complete the round trip
          waypoints.push(startCoords);
          this.visualizeDebugPoints(waypoints);

          // Only proceed if we found all waypoints
          if (waypoints.length === numWaypoints + 1) {
            const route = await this.getRoute(waypoints, activity, 'round');

            // Validate route duration is within acceptable range (0.8 - 1.2 of target)
            const minDuration = duration;
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
          }
        } catch (error) {
          console.log(`Attempt ${attempt + 1} failed:`, error);
        }
      }

      if (allRoutes.length === 0) {
        throw new Error('Could not generate any suitable routes');
      }

      // Sort routes by how close they are to target duration
      allRoutes.sort(
        (a, b) =>
          Math.abs(a.summary.duration - duration) -
          Math.abs(b.summary.duration - duration),
      );

      // Take only the 3 closest routes to target duration
      const topRoutes = allRoutes.slice(0, 3);

      // Display route options and select the best one
      this.displayRouteOptions(topRoutes);

      // Update the attempted routes source with all routes
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

      // Clear the main route source as we're showing all routes in attempted routes
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
      const requestBody = {
        coordinates: waypoints,
        continue_straight: tripType === 'oneway',
      };

      // Add alternative routes options if provided
      if (options.alternative_routes) {
        requestBody.alternative_routes = options.alternative_routes;
      }

      const response = await fetch(
        `https://api.openrouteservice.org/v2/directions/${activity}/geojson`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.ORS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'Failed to get route');
      }

      const data = await response.json();
      console.log('Route API response:', data);

      if (!data.features || !data.features[0] || !data.features[0].geometry) {
        throw new Error('Invalid route data received');
      }

      // Return main route with alternatives if they exist
      const mainRoute = {
        geometry: data.features[0].geometry,
        properties: data.features[0].properties,
        summary: data.features[0].properties.summary,
      };

      if (data.features.length > 1) {
        mainRoute.alternatives = data.features.slice(1).map((feature) => ({
          geometry: feature.geometry,
          properties: feature.properties,
          summary: feature.properties.summary,
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
        const bounds = new maplibregl.LngLatBounds();
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
    input.value = location.properties.label;
    document.getElementById('end-autocomplete-results').style.display = 'none';
    this.endLocation = location.geometry.coordinates;
    this.updateDestinationMarker(this.endLocation);
  }

  updateDestinationMarker(coordinates) {
    if (this.destinationMarker) {
      this.destinationMarker.remove();
    }
    this.destinationMarker = new maplibregl.Marker({ color: '#FF6B6B' })
      .setLngLat(coordinates)
      .addTo(this.map);

    // Adjust map to show both markers
    if (this.currentLocation) {
      const bounds = new maplibregl.LngLatBounds()
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
          alternative_routes: {
            target_count: 3,
            weight_factor: 1.4,
          },
        },
      );

      const directDuration = directRoute.properties.summary.duration;

      // If direct route is longer than minimum duration, use direct routes
      if (directDuration >= duration) {
        const allDirectRoutes = [
          {
            geometry: directRoute.geometry,
            properties: directRoute.properties,
            summary: directRoute.properties.summary,
            waypoints: [startCoords, endCoords],
          },
        ];

        if (directRoute.alternatives) {
          allDirectRoutes.push(
            ...directRoute.alternatives.map((route) => ({
              geometry: route.geometry,
              properties: route.properties,
              summary: route.properties.summary,
              waypoints: [startCoords, endCoords],
            })),
          );
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

    routeSelectionPanel.style.display = 'block';
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
      const bounds = new maplibregl.LngLatBounds();
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
}

// Create instance and expose necessary methods globally
const routeGenerator = new RouteGenerator();

// For backward compatibility with onclick handlers in HTML
window.getCurrentLocation = () => routeGenerator.getCurrentLocation();
window.generateRoute = () => routeGenerator.generateRoute();
window.swapLocations = () => routeGenerator.swapLocations();
