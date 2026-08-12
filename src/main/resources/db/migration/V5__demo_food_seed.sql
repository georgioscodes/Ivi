-- DEMONSTRATION DATA ONLY.
--
-- These values are approximate figures authored for development, not measured composition data
-- and not fit for clinical use. They exist so the plan builder has something to work with while
-- the real Greek food data is sourced.
--
-- Every row is marked source = 'DEMO_SEED' precisely so it can be found and deleted in one
-- statement when real data arrives:
--
--     DELETE FROM food WHERE source = 'DEMO_SEED';
--
-- Overrides and custom foods created by practitioners carry source = 'PRACTITIONER' and are
-- unaffected by that.

INSERT INTO food (practitioner_id, name_el, name_en, category, energy_kcal, protein_g, carbohydrate_g, fat_g, source) VALUES
-- Fresh
(NULL, 'Μήλο',              'Apple',            'FRESH',        52,  0.3, 14.0,  0.2, 'DEMO_SEED'),
(NULL, 'Μπανάνα',           'Banana',           'FRESH',        89,  1.1, 23.0,  0.3, 'DEMO_SEED'),
(NULL, 'Πορτοκάλι',         'Orange',           'FRESH',        47,  0.9, 12.0,  0.1, 'DEMO_SEED'),
(NULL, 'Αχλάδι',            'Pear',             'FRESH',        57,  0.4, 15.0,  0.1, 'DEMO_SEED'),
(NULL, 'Ντομάτα',           'Tomato',           'FRESH',        18,  0.9,  3.9,  0.2, 'DEMO_SEED'),
(NULL, 'Αγγούρι',           'Cucumber',         'FRESH',        15,  0.7,  3.6,  0.1, 'DEMO_SEED'),
(NULL, 'Μπρόκολο',          'Broccoli',         'FRESH',        34,  2.8,  7.0,  0.4, 'DEMO_SEED'),
(NULL, 'Σπανάκι',           'Spinach',          'FRESH',        23,  2.9,  3.6,  0.4, 'DEMO_SEED'),
(NULL, 'Μαρούλι',           'Lettuce',          'FRESH',        15,  1.4,  2.9,  0.2, 'DEMO_SEED'),

-- Carbohydrate
(NULL, 'Ψωμί ολικής άλεσης','Wholemeal bread',  'CARBOHYDRATE', 247, 13.0, 41.0,  3.4, 'DEMO_SEED'),
(NULL, 'Παξιμάδι κρίθινο',  'Barley rusk',      'CARBOHYDRATE', 350, 10.0, 65.0,  5.0, 'DEMO_SEED'),
(NULL, 'Ρύζι βρασμένο',     'Boiled rice',      'CARBOHYDRATE', 130,  2.7, 28.0,  0.3, 'DEMO_SEED'),
(NULL, 'Μακαρόνια βρασμένα','Boiled pasta',     'CARBOHYDRATE', 158,  5.8, 31.0,  0.9, 'DEMO_SEED'),
(NULL, 'Πατάτα βραστή',     'Boiled potato',    'CARBOHYDRATE',  87,  1.9, 20.0,  0.1, 'DEMO_SEED'),
(NULL, 'Γλυκοπατάτα',       'Sweet potato',     'CARBOHYDRATE',  86,  1.6, 20.0,  0.1, 'DEMO_SEED'),
(NULL, 'Κριτσίνια',         'Breadsticks',      'CARBOHYDRATE', 400, 12.0, 70.0,  8.0, 'DEMO_SEED'),

-- Protein
(NULL, 'Κοτόπουλο στήθος',  'Chicken breast',   'PROTEIN',      165, 31.0,  0.0,  3.6, 'DEMO_SEED'),
(NULL, 'Μοσχαρίσιος κιμάς', 'Beef mince',       'PROTEIN',      250, 26.0,  0.0, 15.0, 'DEMO_SEED'),
(NULL, 'Σαρδέλα',           'Sardine',          'PROTEIN',      208, 25.0,  0.0, 11.0, 'DEMO_SEED'),
(NULL, 'Γαρίδες',           'Prawns',           'PROTEIN',       99, 24.0,  0.2,  0.3, 'DEMO_SEED'),
(NULL, 'Αυγό',              'Egg',              'PROTEIN',      155, 13.0,  1.1, 11.0, 'DEMO_SEED'),
(NULL, 'Φακές βρασμένες',   'Boiled lentils',   'PROTEIN',      116,  9.0, 20.0,  0.4, 'DEMO_SEED'),
(NULL, 'Ρεβίθια βρασμένα',  'Boiled chickpeas', 'PROTEIN',      164,  9.0, 27.0,  2.6, 'DEMO_SEED'),
(NULL, 'Γιαούρτι στραγγιστό 2%', 'Strained yoghurt 2%', 'PROTEIN', 73, 10.0, 4.0, 2.0, 'DEMO_SEED'),
(NULL, 'Φέτα',              'Feta',             'PROTEIN',      264, 14.0,  4.1, 21.0, 'DEMO_SEED'),
(NULL, 'Γραβιέρα',          'Graviera',         'PROTEIN',      390, 27.0,  1.5, 31.0, 'DEMO_SEED'),

-- Fat
(NULL, 'Ελαιόλαδο',         'Olive oil',        'FAT',          884,  0.0,  0.0,100.0, 'DEMO_SEED'),
(NULL, 'Ελιές',             'Olives',           'FAT',          145,  1.0,  3.8, 15.0, 'DEMO_SEED'),
(NULL, 'Καρύδια',           'Walnuts',          'FAT',          654, 15.0, 14.0, 65.0, 'DEMO_SEED'),
(NULL, 'Αμύγδαλα',          'Almonds',          'FAT',          579, 21.0, 22.0, 50.0, 'DEMO_SEED'),
(NULL, 'Ταχίνι',            'Tahini',           'FAT',          595, 17.0, 21.0, 54.0, 'DEMO_SEED'),

-- Composite
(NULL, 'Παστίτσιο',         'Pastitsio',        'COMPOSITE',    190, 10.0, 18.0,  9.0, 'DEMO_SEED'),
(NULL, 'Μουσακάς',          'Moussaka',         'COMPOSITE',    145,  7.0,  9.0,  9.0, 'DEMO_SEED'),
(NULL, 'Χωριάτικη σαλάτα',  'Greek salad',      'COMPOSITE',    105,  3.0,  5.0,  8.0, 'DEMO_SEED');

-- Every food gets a gram portion, so nothing is ever unusable for lack of a unit.
INSERT INTO food_portion (food_id, label_el, grams, is_default, sort_order)
SELECT id, '100 γραμμάρια', 100, FALSE, 90 FROM food WHERE source = 'DEMO_SEED';

-- Natural units, which is how practitioners actually work.
INSERT INTO food_portion (food_id, label_el, grams, is_default, sort_order)
SELECT f.id, p.label, p.grams, TRUE, 0
FROM food f
JOIN (VALUES
    ('Μήλο',                   'μέτριο τεμάχιο',   150.0),
    ('Μπανάνα',                'μέτρια',           120.0),
    ('Πορτοκάλι',              'μέτριο τεμάχιο',   140.0),
    ('Αχλάδι',                 'μέτριο τεμάχιο',   160.0),
    ('Ντομάτα',                'μέτρια',           120.0),
    ('Αγγούρι',                'μέτριο',           200.0),
    ('Μπρόκολο',               'φλιτζάνι',          90.0),
    ('Σπανάκι',                'φλιτζάνι',          30.0),
    ('Μαρούλι',                'φλιτζάνι',          50.0),
    ('Ψωμί ολικής άλεσης',     'φέτα',              30.0),
    ('Παξιμάδι κρίθινο',       'τεμάχιο',           35.0),
    ('Ρύζι βρασμένο',          'φλιτζάνι',         160.0),
    ('Μακαρόνια βρασμένα',     'φλιτζάνι',         140.0),
    ('Πατάτα βραστή',          'μέτρια',           150.0),
    ('Γλυκοπατάτα',            'μέτρια',           130.0),
    ('Κριτσίνια',              'τεμάχιο',            8.0),
    ('Κοτόπουλο στήθος',       'μερίδα',           120.0),
    ('Μοσχαρίσιος κιμάς',      'μερίδα',           100.0),
    ('Σαρδέλα',                'τεμάχιο',           25.0),
    ('Γαρίδες',                'μερίδα',           100.0),
    ('Αυγό',                   'τεμάχιο',           55.0),
    ('Φακές βρασμένες',        'φλιτζάνι',         200.0),
    ('Ρεβίθια βρασμένα',       'φλιτζάνι',         160.0),
    ('Γιαούρτι στραγγιστό 2%', 'κεσεδάκι',         200.0),
    ('Φέτα',                   'μερίδα',            30.0),
    ('Γραβιέρα',               'φέτα',              25.0),
    ('Ελαιόλαδο',              'κουταλιά σούπας',   15.0),
    ('Ελιές',                  'τεμάχιο',            5.0),
    ('Καρύδια',                'τεμάχιο',            8.0),
    ('Αμύγδαλα',               'τεμάχιο',            1.2),
    ('Ταχίνι',                 'κουταλιά σούπας',   16.0),
    ('Παστίτσιο',              'μερίδα',           250.0),
    ('Μουσακάς',               'μερίδα',           250.0),
    ('Χωριάτικη σαλάτα',       'μερίδα',           200.0)
) AS p(name, label, grams) ON p.name = f.name_el
WHERE f.source = 'DEMO_SEED';
