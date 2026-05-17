-- ============================================================================
-- Seed 41 ingredients across three types:
--   - 10 in `graines` (true seeds eaten as food)
--   - 29 in `fruits` (nuts/drupes + dried fruits)
--   - 2  in `legumineuses` (cacahuète, botanically a pulse)
-- Idempotent via ON CONFLICT on lower(ingredient_name).
-- ============================================================================

insert into public.ingredient (ingredient_name, ingredient_default_unit, ingredient_type)
values
  -- ----------- GRAINES (10) -----------
  ('Graines de chia',           'g', 'graines'),
  ('Graines de lin brun',       'g', 'graines'),
  ('Graines de lin doré',       'g', 'graines'),
  ('Graines de tournesol',      'g', 'graines'),
  ('Graines de courge',         'g', 'graines'),
  ('Graines de sésame blanc',   'g', 'graines'),
  ('Graines de sésame noir',    'g', 'graines'),
  ('Graines de chanvre',        'g', 'graines'),
  ('Graines de pavot',          'g', 'graines'),
  ('Pignon de pin',             'g', 'graines'),

  -- ----------- FRUITS À COQUE / OLÉAGINEUX (14) → fruits -----------
  ('Amande',                    'g',     'fruits'),
  ('Amande émondée',            'g',     'fruits'),
  ('Amande effilée',            'g',     'fruits'),
  ('Amande en poudre',          'g',     'fruits'),
  ('Noix',                      'g',     'fruits'),
  ('Noisette',                  'g',     'fruits'),
  ('Noisette en poudre',        'g',     'fruits'),
  ('Pistache',                  'g',     'fruits'),
  ('Noix de cajou',             'g',     'fruits'),
  ('Noix de pécan',             'g',     'fruits'),
  ('Noix de macadamia',         'g',     'fruits'),
  ('Noix du Brésil',            'g',     'fruits'),
  ('Noix de coco râpée',        'g',     'fruits'),
  ('Noix de coco copeaux',      'g',     'fruits'),

  -- ----------- FRUITS SECS (15) → fruits -----------
  ('Raisin sec',                'g',     'fruits'),
  ('Raisin sec doré',           'g',     'fruits'),
  ('Raisin de Corinthe',        'g',     'fruits'),
  ('Sultanine',                 'g',     'fruits'),
  ('Datte',                     'g',     'fruits'),
  ('Datte Medjool',             'piece', 'fruits'),
  ('Figue sèche',               'g',     'fruits'),
  ('Abricot sec',               'g',     'fruits'),
  ('Pruneau',                   'g',     'fruits'),
  ('Cranberry séchée',          'g',     'fruits'),
  ('Mangue séchée',             'g',     'fruits'),
  ('Banane séchée',             'g',     'fruits'),
  ('Pomme séchée',              'g',     'fruits'),
  ('Ananas séché',              'g',     'fruits'),
  ('Baies de goji',             'g',     'fruits'),

  -- ----------- CACAHUÈTE → legumineuses (2) -----------
  ('Cacahuète',                 'g',     'legumineuses'),
  ('Cacahuète grillée salée',   'g',     'legumineuses')
on conflict (lower(ingredient_name)) do nothing;
