-- Client charges from the Randox invoice report (ex VAT).
-- Most lines were invoiced at the supplier's gross; the exceptions are the
-- FTWM pages, M4 Tower, Mancunian Arch and two Glasgow lines.

update campaign_lines set client_charge = supplier_gross where supplier_po like 'RAN%';


update campaign_lines set client_charge = 3500
where supplier_po like 'RAN%' and line_type = 'media'
  and (vendor = 'FT' or detail ilike '%FTWM%');

update campaign_lines set client_charge = 6000
where supplier_po like 'RAN%' and line_type = 'media' and detail ilike '%M4 Tower%';

update campaign_lines set client_charge = 36000
where supplier_po = 'RAN0085' and line_type = 'media';

-- Production everywhere is billed at cost.
update campaign_lines set client_charge = supplier_gross
where supplier_po like 'RAN%' and line_type = 'production';

update campaign_lines set client_charge = 6728
where supplier_po like 'RAN%' and detail ilike '%Streethub%';

update campaign_lines set client_charge = 780
where supplier_po like 'RAN%' and detail ilike '%Airport%';


-- Margin by campaign
select c.ref, c.name,
       sum(l.client_charge)::numeric(12,2) as charged_ex_vat,
       sum(l.supplier_net)::numeric(12,2)  as supplier_net,
       (sum(l.client_charge) - sum(l.supplier_net))::numeric(12,2) as margin,
       round((sum(l.client_charge) - sum(l.supplier_net)) / nullif(sum(l.client_charge),0) * 100, 1) as margin_pct
from campaigns c join campaign_lines l on l.campaign_id = c.id
where l.supplier_po like 'RAN%'
group by c.ref, c.name
order by c.ref;
