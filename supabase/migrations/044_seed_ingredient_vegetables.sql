-- ============================================================================
-- Seed the global ingredient catalogue with 100 common vegetables / herbs /
-- mushrooms, all in the `legumes_fruits` rayon. Separate seed migrations
-- will cover other rayons (cremerie, viande_poisson, epicerie, …).
--
-- The unique index ingredient_name_lower_idx (on lower(ingredient_name))
-- makes this insert idempotent — re-running it is a no-op.
-- ============================================================================

insert into public.ingredient (ingredient_name, ingredient_default_unit, ingredient_rayon)
values
  -- Légumes-fruits
  ('Tomate',                  'piece', 'legumes_fruits'),
  ('Tomate cerise',           'g',     'legumes_fruits'),
  ('Concombre',               'piece', 'legumes_fruits'),
  ('Aubergine',               'piece', 'legumes_fruits'),
  ('Courgette',               'piece', 'legumes_fruits'),
  ('Poivron rouge',           'piece', 'legumes_fruits'),
  ('Poivron vert',            'piece', 'legumes_fruits'),
  ('Poivron jaune',           'piece', 'legumes_fruits'),
  ('Piment',                  'piece', 'legumes_fruits'),
  ('Avocat',                  'piece', 'legumes_fruits'),

  -- Bulbes, oignons, ail
  ('Oignon jaune',            'piece', 'legumes_fruits'),
  ('Oignon rouge',            'piece', 'legumes_fruits'),
  ('Oignon blanc',            'piece', 'legumes_fruits'),
  ('Oignon nouveau',          'botte', 'legumes_fruits'),
  ('Échalote',                'piece', 'legumes_fruits'),
  ('Ail',                     'gousse','legumes_fruits'),
  ('Poireau',                 'piece', 'legumes_fruits'),
  ('Ciboule',                 'botte', 'legumes_fruits'),

  -- Racines & tubercules
  ('Pomme de terre',          'g',     'legumes_fruits'),
  ('Patate douce',            'g',     'legumes_fruits'),
  ('Carotte',                 'g',     'legumes_fruits'),
  ('Navet',                   'g',     'legumes_fruits'),
  ('Radis rose',              'botte', 'legumes_fruits'),
  ('Radis noir',              'piece', 'legumes_fruits'),
  ('Betterave',               'g',     'legumes_fruits'),
  ('Panais',                  'g',     'legumes_fruits'),
  ('Topinambour',             'g',     'legumes_fruits'),
  ('Rutabaga',                'g',     'legumes_fruits'),
  ('Céleri-rave',             'piece', 'legumes_fruits'),
  ('Gingembre',               'g',     'legumes_fruits'),
  ('Curcuma frais',           'g',     'legumes_fruits'),
  ('Raifort',                 'g',     'legumes_fruits'),

  -- Choux & crucifères
  ('Brocoli',                 'g',     'legumes_fruits'),
  ('Chou-fleur',              'g',     'legumes_fruits'),
  ('Chou romanesco',          'g',     'legumes_fruits'),
  ('Chou rouge',              'g',     'legumes_fruits'),
  ('Chou vert',               'g',     'legumes_fruits'),
  ('Chou blanc',              'g',     'legumes_fruits'),
  ('Chou frisé',              'g',     'legumes_fruits'),
  ('Chou kale',               'g',     'legumes_fruits'),
  ('Chou de Bruxelles',       'g',     'legumes_fruits'),
  ('Chou pointu',             'g',     'legumes_fruits'),
  ('Pak-choï',                'piece', 'legumes_fruits'),

  -- Salades & feuilles
  ('Laitue',                  'piece', 'legumes_fruits'),
  ('Roquette',                'g',     'legumes_fruits'),
  ('Mâche',                   'g',     'legumes_fruits'),
  ('Frisée',                  'piece', 'legumes_fruits'),
  ('Scarole',                 'piece', 'legumes_fruits'),
  ('Endive',                  'piece', 'legumes_fruits'),
  ('Cresson',                 'botte', 'legumes_fruits'),
  ('Pourpier',                'g',     'legumes_fruits'),
  ('Épinard',                 'g',     'legumes_fruits'),
  ('Blette',                  'botte', 'legumes_fruits'),
  ('Pissenlit',               'g',     'legumes_fruits'),

  -- Tiges
  ('Céleri branche',          'botte', 'legumes_fruits'),
  ('Fenouil',                 'piece', 'legumes_fruits'),
  ('Asperge verte',           'botte', 'legumes_fruits'),
  ('Asperge blanche',         'botte', 'legumes_fruits'),
  ('Artichaut',               'piece', 'legumes_fruits'),
  ('Cardon',                  'g',     'legumes_fruits'),
  ('Rhubarbe',                'g',     'legumes_fruits'),

  -- Cosses & légumineuses fraîches
  ('Petits pois',             'g',     'legumes_fruits'),
  ('Haricot vert',            'g',     'legumes_fruits'),
  ('Haricot beurre',          'g',     'legumes_fruits'),
  ('Haricot plat',            'g',     'legumes_fruits'),
  ('Fève',                    'g',     'legumes_fruits'),
  ('Pois gourmand',           'g',     'legumes_fruits'),
  ('Maïs doux',               'piece', 'legumes_fruits'),

  -- Courges
  ('Courge butternut',        'g',     'legumes_fruits'),
  ('Courge potimarron',       'g',     'legumes_fruits'),
  ('Potiron',                 'g',     'legumes_fruits'),
  ('Citrouille',              'g',     'legumes_fruits'),
  ('Courge spaghetti',        'piece', 'legumes_fruits'),
  ('Pâtisson',                'piece', 'legumes_fruits'),
  ('Courgette ronde',         'piece', 'legumes_fruits'),

  -- Champignons
  ('Champignon de Paris',     'g',     'legumes_fruits'),
  ('Shiitaké',                'g',     'legumes_fruits'),
  ('Pleurote',                'g',     'legumes_fruits'),
  ('Girolle',                 'g',     'legumes_fruits'),
  ('Cèpe',                    'g',     'legumes_fruits'),
  ('Morille',                 'g',     'legumes_fruits'),
  ('Champignon de bois',      'g',     'legumes_fruits'),
  ('Truffe noire',            'g',     'legumes_fruits'),

  -- Herbes aromatiques fraîches
  ('Persil plat',             'botte', 'legumes_fruits'),
  ('Persil frisé',            'botte', 'legumes_fruits'),
  ('Basilic',                 'botte', 'legumes_fruits'),
  ('Ciboulette',              'botte', 'legumes_fruits'),
  ('Coriandre',               'botte', 'legumes_fruits'),
  ('Menthe',                  'botte', 'legumes_fruits'),
  ('Thym',                    'botte', 'legumes_fruits'),
  ('Romarin',                 'botte', 'legumes_fruits'),
  ('Sauge',                   'botte', 'legumes_fruits'),
  ('Estragon',                'botte', 'legumes_fruits'),
  ('Aneth',                   'botte', 'legumes_fruits'),
  ('Cerfeuil',                'botte', 'legumes_fruits'),
  ('Origan frais',            'botte', 'legumes_fruits'),
  ('Marjolaine',              'botte', 'legumes_fruits'),
  ('Sarriette',               'botte', 'legumes_fruits'),
  ('Laurier',                 'piece', 'legumes_fruits'),
  ('Citronnelle',             'piece', 'legumes_fruits')
on conflict (lower(ingredient_name)) do nothing;
