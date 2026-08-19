import networkx as nx

from backend.data.city_data import CITY_ROADS


class RouteAgent:

    def build_city_graph(self):
        graph = nx.Graph()

        for road in CITY_ROADS:

            distance = float(
                road["distance_km"]
            )

            speed = max(
                float(road["speed_kmph"]),
                1
            )

            traffic = max(
                0,
                min(
                    float(road["traffic"]),
                    100
                )
            )

            # Normal travel time in hours
            base_time = distance / speed

            # Strong traffic penalty
            #
            # 0%   -> 1.0
            # 20%  -> 2.0
            # 50%  -> 3.5
            # 80%  -> 5.0
            # 100% -> 6.0
            traffic_multiplier = (
                1 + (traffic / 20)
            )

            weight = (
                base_time *
                traffic_multiplier
            )

            # Very congested roads are strongly avoided
            if traffic >= 90:
                weight *= 3

            graph.add_edge(
                road["start"],
                road["end"],
                weight=weight,
                road_id=road["road_id"],
                traffic=traffic,
                distance_km=distance,
                speed_kmph=speed,
                estimated_time=round(
                    weight * 60,
                    2
                )
            )

        return graph

    def find_best_route(
        self,
        start="J1",
        destination="J5"
    ):

        graph = self.build_city_graph()

        try:

            route = nx.shortest_path(
                graph,
                source=start,
                target=destination,
                weight="weight"
            )

            total_weight = nx.shortest_path_length(
                graph,
                source=start,
                target=destination,
                weight="weight"
            )

            roads = []
            total_distance = 0

            for i in range(
                len(route) - 1
            ):

                from_node = route[i]
                to_node = route[i + 1]

                edge = graph[
                    from_node
                ][
                    to_node
                ]

                total_distance += (
                    edge["distance_km"]
                )

                roads.append({
                    "road_id":
                        edge["road_id"],

                    "from":
                        from_node,

                    "to":
                        to_node,

                    "traffic":
                        edge["traffic"],

                    "distance_km":
                        edge["distance_km"],

                    "speed_kmph":
                        edge["speed_kmph"],

                    "estimated_time":
                        edge["estimated_time"]
                })

            # Traffic status of selected route
            route_traffic = [
                road["traffic"]
                for road in roads
            ]

            if not route_traffic:

                traffic_status = "NO DATA"

            else:

                average_traffic = (
                    sum(route_traffic)
                    / len(route_traffic)
                )

                if average_traffic >= 70:
                    traffic_status = "HIGH"

                elif average_traffic >= 40:
                    traffic_status = "MEDIUM"

                else:
                    traffic_status = "LOW"

            return {
                "status":
                    "ROUTE_FOUND",

                "start":
                    start,

                "destination":
                    destination,

                "route":
                    route,

                "roads":
                    roads,

                "total_distance_km":
                    round(
                        total_distance,
                        2
                    ),

                "estimated_time":
                    round(
                        total_weight * 60,
                        2
                    ),

                "traffic_status":
                    traffic_status
            }

        except nx.NodeNotFound:

            return {
                "error":
                    "Invalid junction"
            }

        except nx.NetworkXNoPath:

            return {
                "error":
                    "No route available"
            }