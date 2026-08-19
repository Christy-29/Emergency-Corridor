class SignalAgent:

    def create_green_corridor(self, route):
        signal_plan = []

        for junction in route:
            if junction == route[-1]:
                continue

            signal_plan.append({
                "junction": junction,
                "signal": "GREEN",
                "priority": "EMERGENCY"
            })

        return signal_plan