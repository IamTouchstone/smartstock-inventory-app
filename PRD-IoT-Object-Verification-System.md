# Architecture & Technical Blueprint: IoT-Enabled Object Verification System (IOVS)

## Product Requirements Document (PRD)

**Project Title:** IoT-Enabled Object Verification System (IOVS)  
**Document Type:** Architecture & Technical Blueprint | Technical Specification | System Integration Guide  
**Version:** 1.0  
**Date:** May 16, 2026

---

## Table of Contents

1. [Framework & Scope](#1-framework--scope)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Core Engine Implementation (Pseudocode)](#3-core-engine-implementation-pseudocode)
4. [Operational Scenario Demonstration](#4-operational-scenario-demonstration)
5. [Constraints & Deployment Safeguards](#5-constraints--deployment-safeguards)

---

## 1. Framework & Scope

| Element | Description |
|---------|-------------|
| **Role** | World-Class Lead IoT Architect & Systems Engineer |
| **Task** | Design a comprehensive technical blueprint and pseudocode for a CCTV-integrated sensor system that detects item movement, tracks possession, and manages alarms based on Point of Sale (POS) synchronization |
| **Context** | Modern retail environments face sophisticated shrink (theft). Standard optical CCTV fails when items are concealed in bags. This system bridges the gap by blending computer vision with non-line-of-sight sensor technology (RFID/BLE) and POS state machines |
| **Format** | Structured technical specification document featuring architectural components, a data flow matrix, and clean, modular Python pseudocode |

### Constraints

- Must detect items even when hidden from direct optical view
- Must trigger alarms **only** if an item leaves its designated zone **and** is accompanied by a human
- Alarms must persist until a "Sold" status is broadcast by an "I-Class" POS system

---

## 2. System Architecture Overview

To detect items "hidden from view," optical CCTV alone is insufficient. The system utilizes a **Sensor Fusion** approach:

### 2.1 Architectural Layers

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| **Optical Layer (CCTV)** | YOLO (You Only Look Once) | Track human skeletons, coordinates, and bounding boxes |
| **Sensor Layer (RFID/BLE)** | UHF RFID arrays / BLE asset tags | Track physical presence and signal strength (RSSI), even inside bags |
| **POS Integration Layer** | WebSocket or gRPC broker | Connect to "I-Class" supermarket ERP/POS for real-time transaction updates |

### 2.2 Data Flow Matrix

```
[Shelf Sensor Array] ----(Item Disappears)-----> [ Central Fusion Engine ] <--- (Tracks Human) --- [CCTV Camera]
                                                           |
                                                (Item + Human Leave Zone)
                                                           |
                                                           v
[I-Class POS Machine] ---(Syncs 'Sold' Event)---> [ Alarm State Controller ] ---> [ Triggers Physical Alarm ]
```

### 2.3 Component Interaction Summary

1. **Shelf Sensor Array** detects when an item disappears from its designated zone
2. **CCTV Camera** provides continuous human tracking via vision processing
3. **Central Fusion Engine** correlates item movement with human proximity
4. **I-Class POS Machine** broadcasts "Sold" events to clear alarm state
5. **Alarm State Controller** triggers or disarms physical alarms based on fused state

---

## 3. Core Engine Implementation (Pseudocode)

Below is the Python-based architecture managing the state, sensor fusion, and POS synchronization.

```python
import time
import logging
from typing import Dict, List, Tuple

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class ItemState:
    RESTING = "RESTING"          # On the shelf
    MOVING = "MOVING"            # Removed from shelf, tracked in space
    POSSESSED = "POSSESSED"      # Linked to a human entity
    ALARM_ACTIVE = "ALARM_ACTIVE"# Violating perimeter without purchase
    SOLD = "SOLD"                # Cleared by I-Class POS

class Item:
    def __init__(self, item_id: str, original_coords: Tuple[float, float, float]):
        self.item_id = item_id
        self.original_coords = original_coords
        self.current_coords = original_coords
        self.state = ItemState.RESTING
        self.associated_human_id = None

class Human:
    def __init__(self, human_id: str, current_coords: Tuple[float, float, float]):
        self.human_id = human_id
        self.current_coords = current_coords


class SecurityFusionEngine:
    def __init__(self):
        self.inventory: Dict[str, Item] = {}
        self.tracked_humans: Dict[str, Human] = {}
        self.perimeter_boundary_x = 50.0  # Threshold line near the store exit
        
    def register_item(self, item_id: str, coords: Tuple[float, float, float]):
        """Registers store items into the local tracking state machine."""
        self.inventory[item_id] = Item(item_id, coords)

    def update_cctv_vision_feed(self, human_data: List[Tuple[str, Tuple[float, float, float]]]):
        """
        Receives real-time coordinates of humans from the CCTV vision processing unit.
        Format: [(human_id, (x, y, z))]
        """
        self.tracked_humans.clear()
        for human_id, coords in human_data:
            self.tracked_humans[human_id] = Human(human_id, coords)

    def update_sensor_array_feed(self, sensor_data: Dict[str, Tuple[float, float, float]]):
        """
        Receives non-line-of-sight tracking data (RFID/BLE) for items.
        Even if hidden in a bag, the sensor array provides coordinate triangulation.
        Format: {item_id: (x, y, z)}
        """
        for item_id, current_coords in sensor_data.items():
            if item_id not in self.inventory:
                continue
                
            item = self.inventory[item_id]
            if item.state == ItemState.SOLD:
                continue # Ignore items already verified as paid
                
            item.current_coords = current_coords
            self._evaluate_item_state(item)

    def _evaluate_item_state(self, item: Item):
        """Calculates distance transitions and human proximity to manage states."""
        # Check if item moved from its original designated shelf position
        distance_from_origin = self._calculate_distance(item.original_coords, item.current_coords)
        
        if distance_from_origin > 0.5 and item.state == ItemState.RESTING:
            item.state = ItemState.MOVING
            logging.info(f"Alert: Item {item.item_id} moved from original position.")

        # If moving, verify if it is in possession of a human (Sensor Fusion)
        if item.state in [ItemState.MOVING, ItemState.POSSESSED]:
            closest_human, min_distance = self._find_closest_human(item.current_coords)
            
            # If an item is within 1 meter of a tracked human, it's possessed (even if inside a bag)
            if min_distance <= 1.0:
                item.state = ItemState.POSSESSED
                item.associated_human_id = closest_human
            else:
                item.state = ItemState.MOVING
                item.associated_human_id = None

            # Check if the item is passing the exit perimeter while possessed without being sold
            if item.current_coords[0] > self.perimeter_boundary_x and item.state == ItemState.POSSESSED:
                self._trigger_alarm(item)

    def handle_iclass_pos_sync(self, item_id: str):
        """
        Callback endpoint triggered by the I-Class Cashier Software on successful checkout.
        """
        if item_id in self.inventory:
            self.inventory[item_id].state = ItemState.SOLD
            self._disarm_alarm(item_id)
            logging.info(f"POS Sync: Item {item_id} successfully sold. Access cleared.")

    def _trigger_alarm(self, item: Item):
        item.state = ItemState.ALARM_ACTIVE
        print(f"!!! ALARM !!! Audio/Visual alert triggered! Item [{item.item_id}] "
              f"is crossing exit with Human [{item.associated_human_id}] without payment record.")

    def _disarm_alarm(self, item_id: str):
        print(f"Disarming Alarm for Item [{item_id}]: State marked paid.")

    @staticmethod
    def _calculate_distance(coord1: Tuple[float, float, float], coord2: Tuple[float, float, float]) -> float:
        """3D Euclidean distance calculation."""
        return ((coord1[0] - coord2[0])**2 + (coord1[1] - coord2[1])**2 + (coord1[2] - coord2[2])**2)**0.5

    def _find_closest_human(self, item_coords: Tuple[float, float, float]) -> Tuple[str, float]:
        """Finds the nearest human to the sensor signal coordinates."""
        min_distance = float('inf')
        closest_human_id = None
        for human_id, human in self.tracked_humans.items():
            dist = self._calculate_distance(item_coords, human.current_coords)
            if dist < min_distance:
                min_distance = dist
                closest_human_id = human_id
        return closest_human_id, min_distance
```

### 3.1 Item State Machine

```
                    ┌──────────┐
                    │ RESTING  │ (on shelf)
                    └────┬─────┘
                         │ item moves > 0.5m from origin
                         ▼
                    ┌──────────┐
              ┌────│  MOVING  │────┐
              │    └────┬─────┘    │
              │         │ human within 1.0m
              │         ▼          │ no human proximity
              │    ┌──────────┐    │
              │    │POSSESSED │◄───┘
              │    └────┬─────┘
              │         │ crosses perimeter (X > 50) without SOLD
              │         ▼
              │    ┌──────────────┐
              │    │ ALARM_ACTIVE │
              │    └──────┬───────┘
              │           │ I-Class POS sync
              │           ▼
              └──────►┌──────────┐
                      │   SOLD   │ (alarm cleared)
                      └──────────┘
```

### 3.2 Key Thresholds

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Movement threshold | 0.5 m from origin | Detect item removed from shelf |
| Human proximity | ≤ 1.0 m | Confirm item is possessed by a human |
| Perimeter boundary | X = 50.0 | Exit zone trigger line |

---

## 4. Operational Scenario Demonstration

The execution block below demonstrates how the system tracks a product, ignores false alarms, detects concealment inside a bag, and responds to the **I-Class POS** system clear signal.

```python
if __name__ == "__main__":
    # Initialize System Engine
    engine = SecurityFusionEngine()
    
    # 1. Setup Store Inventory (Item ID, (X, Y, Z) Shelf Location)
    # Premium Whiskey Bottle on Shelf A
    engine.register_item("WHISKEY_700ML_0923", (10.0, 2.0, 1.5))
    
    print("--- Scenario Start: Store Operational ---")
    
    # 2. CCTV tracks a customer entering the aisle
    cctv_feed = [("customer_alphanumeric_99", (9.8, 2.1, 0.0))]
    engine.update_cctv_vision_feed(cctv_feed)
    
    # 3. Customer picks up item and places it inside a thick backpack
    # Optical CCTV now LOSES sight of the item, but the RFID/Sensor array tracks its new coordinates
    sensor_feed = {"WHISKEY_700ML_0923": (10.2, 2.2, 1.1)} 
    engine.update_sensor_array_feed(sensor_feed)
    
    # 4. Customer walks towards the exit doors with the item hidden in the bag
    print("\n--- Customer Walking Towards Exit ---")
    cctv_feed = [("customer_alphanumeric_99", (55.2, 2.1, 0.0))] # Crossed the X=50 threshold line
    sensor_feed = {"WHISKEY_700ML_0923": (55.1, 2.2, 1.1)}       # Tag signal moves with them
    
    engine.update_cctv_vision_feed(cctv_feed)
    engine.update_sensor_array_feed(sensor_feed) # This should trigger the alarm condition
    
    # 5. Customer backs up, goes to Cashier Point, and scans the item
    print("\n--- Customer Resolves Checkout at I-Class POS ---")
    # I-Class Business software sends network sync packet to security server
    engine.handle_iclass_pos_sync("WHISKEY_700ML_0923")
    
    # 6. Customer leaves the store with paid merchandise
    print("\n--- Customer Leaves Store Post-Payment ---")
    cctv_feed = [("customer_alphanumeric_99", (60.0, 2.1, 0.0))]
    sensor_feed = {"WHISKEY_700ML_0923": (59.9, 2.2, 1.1)}
    engine.update_cctv_vision_feed(cctv_feed)
    engine.update_sensor_array_feed(sensor_feed) # Alarm will no longer trigger
```

### 4.1 Scenario Walkthrough

| Step | Event | System Response |
|------|-------|-----------------|
| 1 | Item registered on shelf | State: `RESTING` |
| 2 | Customer enters aisle (CCTV tracks human) | Human added to tracking matrix |
| 3 | Customer picks up item, places in backpack | CCTV loses optical view; RFID tracks item → `MOVING` → `POSSESSED` |
| 4 | Customer walks toward exit with concealed item | Item + human cross perimeter → **ALARM triggered** |
| 5 | Customer scans item at I-Class POS | `handle_iclass_pos_sync()` → State: `SOLD`, alarm disarmed |
| 6 | Customer exits with paid merchandise | No alarm (item state is `SOLD`) |

---

## 5. Constraints & Deployment Safeguards

### 5.1 Non-Line-Of-Sight (NLOS) Dependency

Standard camera systems will fail if objects are inside foil-lined bags ("booster bags"). To counter this constraint, the sensor infrastructure must deploy:

- **UHF RFID phase-based distance tracking**, or
- Active **BLE RSSI fingerprinting**

…which ignore standard fabrics and plastics.

### 5.2 False-Alarm Prevention

If an item falls off a shelf due to vibrations, the `min_distance <= 1.0` condition ensures that no alarm triggers because an associated human skeleton is missing from the proximity matrix.

| Condition | Alarm? |
|-----------|--------|
| Item moves, no human within 1.0 m | No |
| Item moves, human within 1.0 m, inside store | No (monitoring only) |
| Item + human cross exit perimeter, not sold | **Yes** |
| Item + human cross exit perimeter, sold via I-Class POS | No |

### 5.3 Fail-Safe Mode

If communication between the **I-Class POS** and the `SecurityFusionEngine` drops, the system defaults to an **analytical warning state** rather than hard lockouts, preventing customer friction during high-traffic intervals.

### 5.4 Deployment Requirements Summary

| Requirement | Specification |
|-------------|---------------|
| Sensor technology | UHF RFID phase-based or BLE RSSI |
| Vision processing | YOLO-based human skeleton tracking |
| POS integration | I-Class via WebSocket or gRPC |
| Alarm trigger | Item + human leave zone without `SOLD` status |
| Alarm clear | I-Class broadcasts sold event |
| Fail-safe | Warning state on POS comms loss (no hard lockout) |

---

## 6. Integration Points

| System | Protocol | Data Exchanged |
|--------|----------|----------------|
| CCTV Vision Unit | Internal API / message bus | Human ID, (x, y, z) coordinates |
| RFID/BLE Sensor Array | Internal API / message bus | Item ID, (x, y, z) coordinates |
| I-Class POS | WebSocket / gRPC | Item ID, sold status |
| Alarm State Controller | GPIO / network relay | Alarm trigger / disarm signals |

---

## 7. Conclusion

The **IoT-Enabled Object Verification System (IOVS)** provides a sensor-fusion loss prevention architecture for high-end supermarkets. By combining optical human tracking, non-line-of-sight item tracking (RFID/BLE), and real-time I-Class POS synchronization, the system detects concealed merchandise movement, triggers alarms only when items leave with humans without payment, and clears alarms upon verified checkout.

---

*End of Document*
