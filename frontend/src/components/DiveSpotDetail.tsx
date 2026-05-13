import { useEffect, useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TideCurve } from './TideCurve';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

interface DiveSpot {
  spotId: number;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  difficulty_level: string | null;
  depth_max_meters: number | null;
  facing_direction: number | null;
  /** True when API filled facing from lat/lon heuristic (not stored in DB). */
  facing_direction_estimated?: boolean;
  description: string;
  /** e.g. Snorkeling, Freediving, Spearfishing, Scuba */
  suitable_for?: string[] | null;
  /** Driving / walking directions to the site */
  getting_there?: string | null;
  /** Where to park */
  parking_location?: string | null;
  /** yes | no | optional */
  boat_required?: string | null;
  /** Walk time or distance from parking to water entry */
  parking_to_entry_walk?: string | null;
  /** Extra access tips */
  access_notes?: string | null;
  /** Public HTTPS URLs (e.g. S3) shown as right-column photo banner */
  banner_image_urls?: string[] | null;
}

interface ConditionsData {
  location: { latitude: number; longitude: number };
  tide: {
    metadata?: {
      latitude: number;
      longitude: number;
      datum: string;
      start: string;
      days: number;
      height: string;
    };
    values: Array<{ time: string; value: number }>;
  };
  weather: {
    current: {
      temperature: number;
      wind_speed: number;
      wind_direction: string | number;
      humidity?: number;
      cloud_cover?: number;
    };
  };
  visibility?: {
    visibility_meters: number;
    level: string;
    color: string;
    rating: number;
    recommendation: string;
    factors?: {
      wind_impact: number;
      cloud_impact: number;
      humidity_impact: number;
      tide_impact: number;
    };
  };
  wetsuit?: {
    recommended_mm: 3 | 5 | 7;
    label: string;
    summary: string;
    alt_hint: string | null;
    estimated_effective_c: number;
    air_temp_used_c: number;
    wind_speed_ms: number;
    note: string;
  } | null;
  cached_time: string;
}

function boatRequiredLabel(v: string | null | undefined): string | null {
  if (v == null || String(v).trim() === '') return null;
  const s = String(v).toLowerCase().trim();
  if (s === 'yes') return 'Boat needed to dive this site.';
  if (s === 'no') return 'Shore or jetty access; no boat required.';
  if (s === 'optional') return 'Boat is optional.';
  return String(v);
}

/** One paragraph for overview + access (easier to read than many small labels). */
function buildFullSiteNarrative(spot: DiveSpot): string {
  const parts: string[] = [];
  const desc = (spot.description || '').trim().replace(/\s+/g, ' ');
  if (desc) parts.push(desc);
  if (spot.suitable_for && spot.suitable_for.length > 0) {
    parts.push(`Suitable for ${spot.suitable_for.join(', ')}.`);
  }
  if (spot.getting_there?.trim()) parts.push(spot.getting_there.trim().replace(/\s+/g, ' '));
  if (spot.parking_location?.trim()) parts.push(`Parking: ${spot.parking_location.trim()}.`);
  const boat = boatRequiredLabel(spot.boat_required);
  if (boat) parts.push(boat);
  if (spot.parking_to_entry_walk?.trim()) {
    parts.push(`Parking to water entry: ${spot.parking_to_entry_walk.trim()}.`);
  }
  if (spot.access_notes?.trim()) parts.push(spot.access_notes.trim().replace(/\s+/g, ' '));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** One hero image per spot; if several URLs exist, index by spotId so sites don’t all show the same frame. */
function pickHeroBannerUrl(spot: DiveSpot): string | null {
  const urls = spot.banner_image_urls;
  if (!urls?.length) return null;
  const idx = Math.abs(Number(spot.spotId)) % urls.length;
  const u = urls[idx];
  if (typeof u !== 'string') return null;
  const t = u.trim();
  return /^https?:\/\//i.test(t) ? t : null;
}

const WETSUIT_TAG: Record<3 | 5 | 7, string> = {
  3: 'Light',
  5: 'Standard',
  7: 'Heavy',
};

export function DiveSpotDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [spot, setSpot] = useState<DiveSpot | null>(null);
  const [conditions, setConditions] = useState<ConditionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroLoadFailed, setHeroLoadFailed] = useState(false);

  useEffect(() => {
    fetchSpotDetails();
  }, [id]);

  useEffect(() => {
    setHeroLoadFailed(false);
  }, [id, spot]);

  const fetchSpotDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [spotRes, conditionsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/dive-spots/${id}`),
        axios.get(`${API_BASE_URL}/api/conditions`, { params: { spotId: id } }),
      ]);
      setSpot(spotRes.data.data);
      console.log('Conditions data:', conditionsRes.data.data);
      setConditions(conditionsRes.data.data);
    } catch (err) {
      setError('Failed to fetch spot details. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getWindDirection = (degrees: number | string): string => {
    if (typeof degrees === 'string') {
      return degrees; // Already in format like "NNE"
    }
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  const formatFacing = (deg: number | null | undefined) => {
    if (deg == null || Number.isNaN(Number(deg))) return null;
    const n = Number(deg);
    return `${n}° (${getWindDirection(n)})`;
  };

  const formatDepthM = (m: number | null | undefined) =>
    m != null && !Number.isNaN(Number(m)) ? `${m}m` : null;

  const missingHintStyle: CSSProperties = {
    margin: '4px 0 0',
    fontSize: '11px',
    color: '#999',
    lineHeight: 1.45,
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !spot) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'red' }}>{error || 'Spot not found'}</p>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>
    );
  }

  const facingStr = formatFacing(spot.facing_direction);
  const depthStr = formatDepthM(spot.depth_max_meters);
  const siteNarrative = buildFullSiteNarrative(spot);
  const heroBannerUrl = pickHeroBannerUrl(spot);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
      {/* Header */}
      <div style={{ width: '100%', marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '20px',
          }}
        >
          ← Back
        </button>
      </div>

      <div style={{ width: '100%' }}>
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            marginBottom: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: heroBannerUrl
              ? 'minmax(0, 1fr) minmax(220px, clamp(280px, 48vw, 560px))'
              : 'minmax(0, 1fr)',
            alignItems: 'stretch',
            minHeight: heroBannerUrl ? 200 : undefined,
          }}
        >
          <div style={{ padding: '28px 30px', minWidth: 0 }}>
            <h1 style={{ margin: '0 0 10px 0', color: '#333' }}>{spot.name}</h1>
            <p style={{ margin: '0 0 20px 0', color: '#555', fontSize: 15 }}>
              {spot.region} • Level: {spot.difficulty_level ?? 'Not provided'} • Max Depth: {depthStr ?? 'Not provided'}
            </p>
            {(!spot.difficulty_level || depthStr == null) && (
              <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>
                “Not provided” means this detail is missing in the dive spot database (it can be added when editing the
                site record).
              </p>
            )}
          </div>
          {heroBannerUrl && (
            <div
              style={{
                position: 'relative',
                minHeight: 200,
                background: '#e8e8e8',
              }}
            >
              {!heroLoadFailed ? (
                <img
                  src={heroBannerUrl}
                  alt={`${spot.name} — cover photo`}
                  onError={() => setHeroLoadFailed(true)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                  }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                    textAlign: 'center',
                    fontSize: 13,
                    color: '#666',
                    lineHeight: 1.5,
                  }}
                >
                  Photo could not load (often a private S3 bucket). Use public read on the objects, or set
                  S3_BANNER_BUCKET in backend .env and grant this app’s IAM user s3:GetObject, then restart the API.
                </div>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
            gap: '20px',
            marginBottom: '20px',
            alignItems: 'start',
          }}
        >
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>Dive Spot Info</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Coordinates</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>
                  {spot.latitude.toFixed(4)}, {spot.longitude.toFixed(4)}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Facing</p>
                {facingStr ? (
                  <>
                    <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{facingStr}</p>
                    {spot.facing_direction_estimated && (
                      <p style={missingHintStyle}>
                        Approximate bearing from coordinates (not from a survey). Save a real value in the database for
                        accuracy.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Not provided</p>
                    <p style={missingHintStyle}>
                      No compass bearing (degrees from north) is stored, and no estimate is available for this location.
                    </p>
                  </>
                )}
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Max Depth</p>
                {depthStr ? (
                  <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{depthStr}</p>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Not provided</p>
                    <p style={missingHintStyle}>
                      Maximum typical depth (metres) for this site is not saved in the database.
                    </p>
                  </>
                )}
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Difficulty</p>
                {spot.difficulty_level ? (
                  <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{spot.difficulty_level}</p>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Not provided</p>
                    <p style={missingHintStyle}>
                      Difficulty (e.g. Beginner / Intermediate / Advanced) is not saved for this dive spot.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: 22,
                paddingTop: 20,
                borderTop: '1px solid #eee',
              }}
            >
              <p style={{ margin: '0 0 10px', color: '#999', fontSize: 12 }}>Description</p>
              <p
                style={{
                  margin: 0,
                  color: '#303030',
                  fontSize: 17,
                  lineHeight: 1.75,
                  letterSpacing: '0.01em',
                }}
              >
                {siteNarrative || (
                  <span style={{ color: '#757575' }}>No written description for this site yet.</span>
                )}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%' }}>
            {conditions && (
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <h3 style={{ marginTop: 0, color: '#333' }}>Current Conditions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Temperature</p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{conditions.weather.current.temperature}°C</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Wind Speed</p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{conditions.weather.current.wind_speed} m/s</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Wind Direction</p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>
                      {getWindDirection(conditions.weather.current.wind_direction)}
                    </p>
                  </div>
                  {conditions.weather.current.humidity !== undefined && (
                    <div>
                      <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Humidity</p>
                      <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{conditions.weather.current.humidity}%</p>
                    </div>
                  )}
                  {conditions.weather.current.cloud_cover !== undefined && (
                    <div>
                      <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Cloud Cover</p>
                      <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{conditions.weather.current.cloud_cover}%</p>
                    </div>
                  )}
                  {conditions.wetsuit && (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        paddingTop: '10px',
                        borderTop: '1px solid #eee',
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'nowrap',
                        gap: '12px',
                      }}
                    >
                      <span style={{ color: '#999', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>WETSUIT</span>
                      <span style={{ color: '#999', fontSize: '12px', flexShrink: 0 }}>Wetsuit</span>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#333', lineHeight: 1.2, flexShrink: 0 }}>
                        {conditions.wetsuit.label}
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: '#1890ff', flexShrink: 0 }}>
                        {WETSUIT_TAG[conditions.wetsuit.recommended_mm]}
                      </span>
                    </div>
                  )}
                  {conditions.visibility && (
                    <>
                      <div style={{ gridColumn: '1 / -1', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                        <p style={{ margin: '0 0 8px 0', color: '#999', fontSize: '12px', fontWeight: '600' }}>UNDERWATER VISIBILITY</p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Visibility</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                          <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: conditions.visibility.color, lineHeight: 1.2 }}>
                            {conditions.visibility.visibility_meters}m
                          </p>
                          <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: conditions.visibility.color }}>
                            {conditions.visibility.level}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Rating</p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '22px',
                            fontWeight: '600',
                            color: conditions.visibility.color,
                            lineHeight: 1.2,
                            letterSpacing: '0.06em',
                          }}
                        >
                          {'★'.repeat(conditions.visibility.rating)}{'☆'.repeat(5 - conditions.visibility.rating)}
                        </p>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Recommendation</p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#666', lineHeight: '1.4' }}>
                          {conditions.visibility.recommendation}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {conditions && (
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>Tide Chart</h3>
            <TideCurve data={conditions.tide} />
            <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#999', textAlign: 'right' }}>
              Updated: {new Date(conditions.cached_time).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
