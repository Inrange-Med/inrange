-- 19 Nov 2026: no waiting. Every cart opens the moment its prescription is sent, plan or not; open the ones still held.
update public.medicine_carts set available_at = now() where status = 'OPEN' and available_at > now();
