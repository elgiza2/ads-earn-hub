CREATE TABLE public.ads_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint UNIQUE NOT NULL,
  first_name text, username text, photo_url text, language text NOT NULL DEFAULT 'en',
  usdt numeric NOT NULL DEFAULT 0, gram numeric NOT NULL DEFAULT 0, ads numeric NOT NULL DEFAULT 0,
  tickets integer NOT NULL DEFAULT 1, ads_watched integer NOT NULL DEFAULT 0,
  referred_by bigint, referrals integer NOT NULL DEFAULT 0,
  booster text, booster_mult numeric NOT NULL DEFAULT 1, booster_until timestamptz,
  last_ad_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ads_ad_views (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_id bigint NOT NULL, currency text NOT NULL, amount numeric NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ads_ad_views_tg_idx ON public.ads_ad_views(telegram_id, created_at DESC);
CREATE TABLE public.ads_spins (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_id bigint NOT NULL, currency text NOT NULL, amount numeric NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ads_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text UNIQUE NOT NULL, title text NOT NULL,
  kind text NOT NULL, target integer NOT NULL DEFAULT 0, link text,
  reward_currency text NOT NULL, reward_amount numeric NOT NULL, sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ads_user_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_id bigint NOT NULL, task_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(telegram_id, task_key));
CREATE TABLE public.ads_payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_id bigint NOT NULL, product text NOT NULL, amount_ton numeric NOT NULL, memo text UNIQUE NOT NULL, status text NOT NULL DEFAULT 'pending', tx_hash text, created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz);
CREATE TABLE public.ads_withdrawals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_id bigint NOT NULL, currency text NOT NULL, amount numeric NOT NULL, address text NOT NULL, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ads_translations (lang text PRIMARY KEY, version integer NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());

GRANT ALL ON public.ads_users, public.ads_ad_views, public.ads_spins, public.ads_tasks, public.ads_user_tasks, public.ads_payments, public.ads_withdrawals, public.ads_translations TO service_role;
ALTER TABLE public.ads_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_ad_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_translations ENABLE ROW LEVEL SECURITY;

INSERT INTO public.ads_tasks (key,title,kind,target,link,reward_currency,reward_amount,sort_order) VALUES
('join_channel','Join @adsgrq channel','channel',0,'https://t.me/adsgrq','GRAM',0.0005,1),
('watch_50','Watch 50 ads','watch',50,null,'GRAM',0.0005,2),
('watch_100','Watch 100 ads','watch',100,null,'GRAM',0.0005,3),
('invite_3','Invite 3 friends','invite',3,null,'GRAM',0.0005,4),
('watch_500','Watch 500 ads','watch',500,null,'USDT',3,5),
('watch_1000','Watch 1000 ads','watch',1000,null,'USDT',8,6),
('watch_2500','Watch 2500 ads','watch',2500,null,'USDT',25,7),
('watch_5000','Watch 5000 ads','watch',5000,null,'USDT',60,8);