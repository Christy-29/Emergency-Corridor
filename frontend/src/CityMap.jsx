import React, { useEffect, useMemo, useRef, useState } from "react";

const NODES = {
  J1: { x: 120, y: 330, label: "J1" },
  J2: { x: 360, y: 150, label: "J2" },
  J3: { x: 360, y: 510, label: "J3" },
  J4: { x: 650, y: 150, label: "J4" },
  J5: { x: 900, y: 330, label: "J5", hospital: true },
};

const ROADS = [
  { id: "R1", from: "J1", to: "J2" },
  { id: "R2", from: "J1", to: "J3" },
  { id: "R3", from: "J2", to: "J3" },
  { id: "R4", from: "J2", to: "J4" },
  { id: "R5", from: "J3", to: "J5" },
  { id: "R6", from: "J4", to: "J5" },
];

const INITIAL_CONGESTION = {
  R1: 20,
  R2: 70,
  R3: 35,
  R4: 20,
  R5: 25,
  R6: 35,
};

function getRoadKey(a, b) {
  return ROADS.find(
    (r) =>
      (r.from === a && r.to === b) ||
      (r.from === b && r.to === a)
  )?.id;
}

function getNeighbors(node) {
  return ROADS.filter(
    (road) => road.from === node || road.to === node
  ).map((road) => ({
    node: road.from === node ? road.to : road.from,
    roadId: road.id,
  }));
}

/*
 * Dijkstra:
 * Higher congestion = higher travel cost.
 * Ambulance prefers roads with less congestion.
 */
function calculateRoute(start, destination, congestion) {
  const distances = {};
  const previous = {};
  const visited = new Set();

  Object.keys(NODES).forEach((node) => {
    distances[node] = Infinity;
    previous[node] = null;
  });

  distances[start] = 0;

  while (visited.size < Object.keys(NODES).length) {
    let current = null;
    let smallest = Infinity;

    Object.keys(NODES).forEach((node) => {
      if (!visited.has(node) && distances[node] < smallest) {
        smallest = distances[node];
        current = node;
      }
    });

    if (!current) break;

    visited.add(current);

    if (current === destination) break;

    getNeighbors(current).forEach(({ node, roadId }) => {
      const traffic = congestion[roadId] ?? 0;

      /*
       * Base road cost + congestion penalty.
       * This makes very congested roads much less attractive.
       */
      const cost = 1 + traffic / 25;

      const newDistance = distances[current] + cost;

      if (newDistance < distances[node]) {
        distances[node] = newDistance;
        previous[node] = {
          node: current,
          roadId,
        };
      }
    });
  }

  const path = [];
  const roads = [];

  let current = destination;

  while (current) {
    path.unshift(current);

    if (previous[current]) {
      roads.unshift(previous[current].roadId);
      current = previous[current].node;
    } else {
      break;
    }
  }

  if (path[0] !== start) {
    return {
      nodes: [start],
      roads: [],
    };
  }

  return {
    nodes: path,
    roads,
  };
}

function interpolate(a, b, progress) {
  return {
    x: a.x + (b.x - a.x) * progress,
    y: a.y + (b.y - a.y) * progress,
  };
}

function congestionColor(value) {
  if (value >= 75) return "#ef4444";
  if (value >= 50) return "#f59e0b";
  if (value >= 30) return "#38bdf8";
  return "#64748b";
}

function congestionLabel(value) {
  if (value >= 75) return "HEAVY";
  if (value >= 50) return "HIGH";
  if (value >= 30) return "MEDIUM";
  return "LOW";
}

export default function CityMap({
  congestion = INITIAL_CONGESTION,
  onRouteChange,
}) {
  const [currentNode, setCurrentNode] = useState("J1");
  const [route, setRoute] = useState(
    calculateRoute("J1", "J5", congestion)
  );

  const [segmentIndex, setSegmentIndex] = useState(0);
  const [segmentProgress, setSegmentProgress] = useState(0);

  const animationRef = useRef(null);
  const lastTimeRef = useRef(null);

  /*
   * Recalculate route whenever congestion changes.
   */
  useEffect(() => {
    const newRoute = calculateRoute(currentNode, "J5", congestion);

    setRoute(newRoute);

    if (onRouteChange) {
      onRouteChange(newRoute);
    }
  }, [congestion, currentNode, onRouteChange]);

  /*
   * Ambulance animation.
   *
   * Important:
   * Ambulance only moves between actual junction coordinates.
   * It never jumps directly from one unrelated junction to another.
   */
  useEffect(() => {
    cancelAnimationFrame(animationRef.current);

    if (currentNode === "J5") {
      setSegmentIndex(0);
      setSegmentProgress(1);
      return;
    }

    if (route.nodes.length < 2) return;

    let lastTime = performance.now();
    lastTimeRef.current = lastTime;

    const animate = (time) => {
      const delta = time - lastTime;
      lastTime = time;

      setSegmentProgress((previous) => {
        const currentRoad = route.roads[segmentIndex];

        if (!currentRoad) {
          return 1;
        }

        const traffic = congestion[currentRoad] ?? 0;

        /*
         * Higher congestion = slower ambulance.
         * Emergency vehicle still gets through, but traffic affects speed.
         */
        const speed =
          traffic >= 80
            ? 0.00016
            : traffic >= 60
            ? 0.00021
            : traffic >= 40
            ? 0.00026
            : 0.00032;

        const nextProgress = previous + delta * speed;

        if (nextProgress >= 1) {
          const nextNode = route.nodes[segmentIndex + 1];

          setCurrentNode(nextNode);

          if (nextNode === "J5") {
            setSegmentIndex(segmentIndex);
            return 1;
          }

          setSegmentIndex((index) => index + 1);

          /*
           * Reset this segment to zero.
           */
          return 0;
        }

        return nextProgress;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [route, segmentIndex, congestion, currentNode]);

  /*
   * Current ambulance position.
   */
  const ambulancePosition = useMemo(() => {
    if (currentNode === "J5") {
      return NODES.J5;
    }

    if (route.nodes.length < 2) {
      return NODES[currentNode];
    }

    const fromNode = route.nodes[segmentIndex];
    const toNode = route.nodes[segmentIndex + 1];

    if (!fromNode || !toNode) {
      return NODES[currentNode];
    }

    return interpolate(
      NODES[fromNode],
      NODES[toNode],
      segmentProgress
    );
  }, [route, segmentIndex, segmentProgress, currentNode]);

  const nextNode =
    currentNode === "J5"
      ? "HOSPITAL"
      : route.nodes[route.nodes.indexOf(currentNode) + 1] || "J5";

  /*
   * The next junction in the ambulance route gets GREEN.
   */
  const greenNode =
    currentNode === "J5"
      ? "J5"
      : nextNode;

  return (
    <div className="map-wrapper">
      <svg
        className="city-map"
        viewBox="0 0 1020 650"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="ambulanceGlow">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect
          x="0"
          y="0"
          width="1020"
          height="650"
          rx="25"
          fill="#03131b"
        />

        {/* District labels */}
        <text x="75" y="90" className="district-label">
          WEST DISTRICT
        </text>

        <text x="400" y="90" className="district-label">
          NORTH DISTRICT
        </text>

        <text x="705" y="90" className="district-label">
          EAST DISTRICT
        </text>

        {/* Roads */}
        {ROADS.map((road) => {
          const from = NODES[road.from];
          const to = NODES[road.to];

          const traffic = congestion[road.id] ?? 0;

          const isRouteRoad = route.roads.includes(road.id);

          return (
            <g key={road.id}>
              {/* Road shadow */}
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#000"
                strokeWidth="30"
                opacity="0.4"
              />

              {/* Actual road */}
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isRouteRoad ? "#10e7a5" : "#334b5a"}
                strokeWidth="18"
                strokeLinecap="round"
                filter={isRouteRoad ? "url(#glow)" : undefined}
              />

              {/* Congestion overlay */}
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={congestionColor(traffic)}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="10 10"
                opacity={isRouteRoad ? 0.95 : 0.8}
              />

              {/* Emergency route */}
              {isRouteRoad && (
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#00ffb3"
                  strokeWidth="5"
                  strokeDasharray="14 12"
                  strokeLinecap="round"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="-52"
                    dur="0.7s"
                    repeatCount="indefinite"
                  />
                </line>
              )}

              {/* Road label */}
              <g
                transform={`translate(
                  ${(from.x + to.x) / 2},
                  ${(from.y + to.y) / 2}
                )`}
              >
                <rect
                  x="-38"
                  y="-18"
                  width="76"
                  height="36"
                  rx="10"
                  fill="#061d27"
                  stroke={congestionColor(traffic)}
                  strokeWidth="1.5"
                />

                <text
                  x="0"
                  y="-2"
                  textAnchor="middle"
                  className="road-id"
                >
                  {road.id}
                </text>

                <text
                  x="0"
                  y="12"
                  textAnchor="middle"
                  className="road-congestion"
                >
                  {traffic}%
                </text>
              </g>
            </g>
          );
        })}

        {/* Junctions */}
        {Object.entries(NODES).map(([id, node]) => {
          const isCurrent = currentNode === id;
          const isGreen = greenNode === id;

          return (
            <g key={id}>
              {isGreen && currentNode !== "J5" && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="42"
                  fill="none"
                  stroke="#00ffb3"
                  strokeWidth="3"
                  opacity="0.7"
                  filter="url(#glow)"
                >
                  <animate
                    attributeName="r"
                    values="36;48;36"
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              <circle
                cx={node.x}
                cy={node.y}
                r="34"
                fill="#071b25"
                stroke={
                  isGreen
                    ? "#00ffb3"
                    : isCurrent
                    ? "#22d3ee"
                    : "#496474"
                }
                strokeWidth="5"
              />

              <text
                x={node.x}
                y={node.y + 7}
                textAnchor="middle"
                className="junction-number"
              >
                {id.replace("J", "")}
              </text>

              <text
                x={node.x}
                y={node.y + 65}
                textAnchor="middle"
                className="junction-label"
              >
                {node.hospital ? "HOSPITAL" : "JUNCTION"}
              </text>

              {/* Traffic signal */}
              <g
                transform={`translate(${node.x + 38}, ${
                  node.y - 25
                })`}
              >
                <rect
                  width="16"
                  height="50"
                  rx="8"
                  fill="#06131a"
                  stroke="#304c5b"
                  strokeWidth="2"
                />

                <circle
                  cx="8"
                  cy="11"
                  r="4"
                  fill={isGreen ? "#00ffb3" : "#1c313b"}
                />

                <circle
                  cx="8"
                  cy="25"
                  r="4"
                  fill="#2d2525"
                />

                <circle
                  cx="8"
                  cy="39"
                  r="4"
                  fill="#2d2525"
                />
              </g>

              {isGreen && (
                <text
                  x={node.x}
                  y={node.y - 48}
                  textAnchor="middle"
                  className="green-label"
                >
                  GREEN
                </text>
              )}
            </g>
          );
        })}

        {/* Ambulance */}
        <g
          transform={`translate(${ambulancePosition.x}, ${ambulancePosition.y})`}
          filter="url(#ambulanceGlow)"
        >
          <circle
            cx="0"
            cy="0"
            r="30"
            fill="#ef4444"
            opacity="0.18"
          />

          <circle
            cx="0"
            cy="0"
            r="25"
            fill="#071b25"
            stroke="#fff"
            strokeWidth="2"
          />

          <text
            x="0"
            y="9"
            textAnchor="middle"
            fontSize="30"
          >
            🚑
          </text>
        </g>

        {/* Ambulance status */}
        <g
          transform={`translate(${ambulancePosition.x - 55}, ${
            ambulancePosition.y + 42
          })`}
        >
          <rect
            width="110"
            height="28"
            rx="8"
            fill="#001d24"
            stroke="#00e7ad"
          />

          <text
            x="55"
            y="19"
            textAnchor="middle"
            className="ambulance-label"
          >
            {currentNode === "J5"
              ? "ARRIVED"
              : "AMBULANCE"}
          </text>
        </g>

        {/* Route information */}
        <g transform="translate(700, 540)">
          <rect
            width="270"
            height="70"
            rx="14"
            fill="#061d28"
            stroke="#1e4f62"
          />

          <text x="18" y="25" className="route-title">
            ACTIVE ROUTE
          </text>

          <text x="18" y="50" className="route-value">
            {route.nodes.join(" → ")}
          </text>
        </g>
      </svg>

      <div className="map-bottom-info">
        <div>
          <span className="info-title">CURRENT</span>
          <strong>{currentNode}</strong>
        </div>

        <div>
          <span className="info-title">NEXT</span>
          <strong>{nextNode}</strong>
        </div>

        <div>
          <span className="info-title">GREEN SIGNAL</span>
          <strong>{greenNode}</strong>
        </div>

        <div>
          <span className="info-title">STATUS</span>
          <strong>
            {currentNode === "J5"
              ? "ARRIVED"
              : "MOVING"}
          </strong>
        </div>
      </div>
    </div>
  );
}
