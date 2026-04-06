import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { Carousel } from './Carousel';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DiveSpot {
  id: number;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  difficulty_level: string;
  depth_max_meters: number;
  facing_direction: number;
  description: string;
}

interface SlideData {
  id: number;
  image: string;
  title: string;
  description: string;
}

export function NZDiveMap() {
  const navigate = useNavigate();
  const [diveSpots, setDiveSpots] = useState<DiveSpot[]>([]);
  const [filteredSpots, setFilteredSpots] = useState<DiveSpot[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const nzCenter: [number, number] = [-40.9006, 174.8860];

  const carouselSlides: SlideData[] = [
    {
      id: 1,
      image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1400&h=600&fit=crop',
      title: 'Bay of Islands',
      description: 'Experience pristine waters and vibrant marine life in this spectacular dive destination.',
    },
    {
      id: 2,
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1400&h=600&fit=crop',
      title: 'Poor Knights Islands',
      description: 'Discover dramatic underwater cliffs and abundant colorful fish populations.',
    },
    {
      id: 3,
      image: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=1400&h=600&fit=crop',
      title: 'Whangaroa Harbour',
      description: 'Explore historic wrecks and stunning kelp forests in pristine northern waters.',
    },
    {
      id: 4,
      image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1400&h=600&fit=crop',
      title: 'White Island',
      description: 'Adventure awaits at this unique geothermally active and biodiverse dive site.',
    },
    {
      id: 5,
      image: 'https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=1400&h=600&fit=crop',
      title: 'Stewart Island',
      description: 'Encounter rare penguins and pristine marine ecosystems in southern New Zealand.',
    },
  ];

  useEffect(() => {
    fetchDiveSpots();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredSpots(diveSpots);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredSpots(
        diveSpots.filter(
          (spot) =>
            spot.name.toLowerCase().includes(term) || spot.region.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, diveSpots]);

  const fetchDiveSpots = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/dive-spots');
      setDiveSpots(response.data.data.spots);
      setFilteredSpots(response.data.data.spots);
    } catch (error) {
      console.error('Error fetching dive spots:', error);
    }
  };

  const handleMarkerClick = (spot: DiveSpot) => {
    navigate(`/detail/${spot.id}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Search Bar */}
      <div
        style={{
          padding: '16px 0',
          backgroundColor: 'white',
          borderBottom: '1px solid #e8e8e8',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: '100%', paddingLeft: '40px', paddingRight: '40px', boxSizing: 'border-box', display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', maxWidth: '500px', width: '100%' }}>
            <input
              type="text"
              placeholder="Search dive spots..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearchTerm(searchTerm)}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '14px',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                outline: 'none',
                transition: 'all 0.3s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#0066cc';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 102, 204, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#d9d9d9';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <button
              onClick={() => setSearchTerm(searchTerm)}
              style={{
                padding: '12px 24px',
                backgroundColor: '#0066cc',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.3s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0052a3';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 102, 204, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#0066cc';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              🔍 Search
            </button>
            <div
              style={{
                padding: '0 12px',
                fontSize: '12px',
                color: '#999',
                whiteSpace: 'nowrap',
                marginLeft: '10px',
              }}
            >
              {filteredSpots.length} / {diveSpots.length}
            </div>
          </div>
        </div>
      </div>

      {/* Carousel */}
      <div style={{ width: '100%' }} >
        <Carousel slides={carouselSlides} autoPlayInterval={5000} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '15px 20px', backgroundColor: '#f9f9f9', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', display: 'flex', gap: '15px', height: '450px', boxSizing: 'border-box' }}>
          <div style={{ flex: searchTerm ? 0.7 : 1, borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <MapContainer center={nzCenter} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />

              {filteredSpots.map((spot) => (
                <Marker
                  key={spot.id}
                  position={[spot.latitude, spot.longitude]}
                  eventHandlers={{
                  click: () => handleMarkerClick(spot),
                }}
              >
                <Popup>
                  <div>
                    <h3 style={{ margin: '0 0 10px 0' }}>{spot.name}</h3>
                    <p style={{ margin: '5px 0' }}>Region: {spot.region}</p>
                    <p style={{ margin: '5px 0' }}>Level: {spot.difficulty_level}</p>
                    <p style={{ margin: '5px 0' }}>Max Depth: {spot.depth_max_meters}m</p>
                    <button
                      onClick={() => handleMarkerClick(spot)}
                      style={{
                        marginTop: '10px',
                        padding: '5px 10px',
                        backgroundColor: '#1890ff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      Details
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
            </MapContainer>
          </div>

          {searchTerm && (
            <div
              style={{
                width: '300px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                overflowY: 'auto',
              }}
            >
              {filteredSpots.length > 0 ? (
                <div style={{ padding: '10px' }}>
                  {filteredSpots.map((spot) => (
                    <div
                      key={spot.id}
                      onClick={() => handleMarkerClick(spot)}
                      style={{
                        padding: '12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginBottom: '8px',
                        backgroundColor: '#f5f5f5',
                        border: '1px solid #e8e8e8',
                        transition: 'all 0.3s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#e6f7ff';
                        (e.currentTarget as HTMLElement).style.borderColor = '#1890ff';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f5f5';
                        (e.currentTarget as HTMLElement).style.borderColor = '#e8e8e8';
                      }}
                    >
                      <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
                        {spot.name}
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>
                        {spot.region} • {spot.difficulty_level}
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#999' }}>
                        Depth: {spot.depth_max_meters}m
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                  No results found
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
