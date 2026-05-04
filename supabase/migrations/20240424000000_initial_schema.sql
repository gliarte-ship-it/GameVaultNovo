-- Create Games table
CREATE TABLE IF NOT EXISTS games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT CHECK (status IN ('Jogando', 'Pendente', 'Zerado', 'Abandonado')) NOT NULL,
  rating NUMERIC(3,1) DEFAULT 0 CHECK (rating >= 0 AND rating <= 10),
  image TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Ensure table column 'description' exists and 'rating' is NUMERIC
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='description') THEN
        ALTER TABLE games ADD COLUMN description TEXT;
    END IF;
    
    IF (SELECT data_type FROM information_schema.columns WHERE table_name='games' AND column_name='rating') = 'smallint' THEN
        ALTER TABLE games ALTER COLUMN rating TYPE NUMERIC(3,1);
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Create policies (using owner_id)
DROP POLICY IF EXISTS "Users can view their own games" ON games;
CREATE POLICY "Users can view their own games" 
  ON games FOR SELECT 
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert their own games" ON games;
CREATE POLICY "Users can insert their own games" 
  ON games FOR INSERT 
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own games" ON games;
CREATE POLICY "Users can update their own games" 
  ON games FOR UPDATE 
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete their own games" ON games;
CREATE POLICY "Users can delete their own games" 
  ON games FOR DELETE 
  USING (auth.uid() = owner_id);

-- Create a function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_updated_at ON games;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON games
FOR EACH ROW
EXECUTE PROCEDURE handle_updated_at();

-- Note: Achievements are computed in the UI based on the games list, 
-- but we could also store unlocked ones if needed.
-- For now, we follow the current app logic which calculates them in-memory.
