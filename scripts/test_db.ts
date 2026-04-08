import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- STORAGE BUCKETS ---');
    const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
    if (bErr) console.error('Error fetching buckets:', bErr);
    else {
        console.log('Buckets:', buckets.map(b => b.name));
        if (!buckets.find(b => b.name === 'firmas')) {
            console.log('Creando bucket firmas...');
            const { data: cb, error: cbErr } = await supabase.storage.createBucket('firmas', { public: false });
            if (cbErr) console.error('Error creando bucket:', cbErr);
            else console.log('Bucket creado:', cb);
        } else {
            console.log('Bucket firmas ya existe.');
        }
    }

    console.log('\n--- ÚLTIMOS REPORTES ---');
    const { data: rs, error: rErr } = await supabase.from('reportes_mantenimiento')
        .select('id, estado_reporte')
        .order('created_at', { ascending: false })
        .limit(3);
    if (rErr) console.error('Error fetching reportes:', rErr);
    else console.log('Últimos 3 reportes:', rs);
}
run();
