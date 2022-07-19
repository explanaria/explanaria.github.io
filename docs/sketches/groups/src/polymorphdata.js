import {parseCIFString, CIFStringTo3DInfo} from "./parseCIF.js"

//kyaniteData, sillimaniteData, andalusiteData
//these CIF files obtained from the American Mineralogist Crystal Structure Database at http://rruff.geo.arizona.edu/AMS/amcsd.php
//visible in 3D at mindat

//kyanite: https://www.mindat.org/min-2303.html
//andalusite: https://www.mindat.org/min-217.html
//sillimanite: https://www.mindat.org/min-3662.html

export const andalusiteData = CIFStringTo3DInfo(`
data_global
_chemical_name_mineral 'Andalusite'
loop_
_publ_author_name
'Winter J K'
'Ghose S'
_journal_name_full 'American Mineralogist'
_journal_volume 64 
_journal_year 1979
_journal_page_first 573
_journal_page_last 586
_publ_section_title
;
 Thermal expansion and high-temperature crystal chemistry of the Al2SiO5 polymorphs
 T = 25 deg C
;
_database_code_amcsd 0000728
_chemical_formula_sum 'Al2 Si O5'
_cell_length_a 7.7980
_cell_length_b 7.9031
_cell_length_c 5.5566
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_cell_volume 342.444
_exptl_crystal_density_diffrn      3.143
_symmetry_space_group_name_H-M 'P n n m'
loop_
_space_group_symop_operation_xyz
  'x,y,z'
  '1/2+x,1/2-y,1/2+z'
  '1/2-x,1/2+y,1/2-z'
  '1/2-x,1/2+y,1/2+z'
  '1/2+x,1/2-y,1/2-z'
  'x,y,-z'
  '-x,-y,z'
  '-x,-y,-z'
loop_
_atom_site_label
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Al1   0.00000   0.00000   0.24190
Al2   0.37050   0.13910   0.50000
Si   0.24600   0.25200   0.00000
Oa   0.42460   0.36290   0.00000
Ob   0.10300   0.40030   0.00000
Oc   0.42330   0.36290   0.50000
Od   0.23050   0.13390   0.23940
loop_
_atom_site_aniso_label
_atom_site_aniso_U_11
_atom_site_aniso_U_22
_atom_site_aniso_U_33
_atom_site_aniso_U_12
_atom_site_aniso_U_13
_atom_site_aniso_U_23
Al1 0.00647 0.00918 0.00360 0.00156 0.00000 0.00000
Al2 0.00277 0.00823 0.00438 0.00000 0.00000 0.00000
Si 0.00216 0.00759 0.00391 0.00000 0.00000 0.00000
Oa 0.00339 0.00981 0.00485 -0.00187 0.00000 0.00000
Ob 0.00308 0.00854 0.01345 0.00062 0.00000 0.00000
Oc 0.00555 0.00886 0.00469 -0.00094 0.00000 0.00000
Od 0.00493 0.01013 0.00469 -0.00125 -0.00088 0.00111

`)

export const kyaniteData = (CIFStringTo3DInfo(
`
data_global
_chemical_name_mineral 'Kyanite'
loop_
_publ_author_name
'Winter J K'
'Ghose S'
_journal_name_full 'American Mineralogist'
_journal_volume 64 
_journal_year 1979
_journal_page_first 573
_journal_page_last 586
_publ_section_title
;
 Thermal expansion and high-temperature crystal chemistry of the Al2SiO5 polymorphs
 T = 25 deg C
;
_database_code_amcsd 0000733
_chemical_formula_sum 'Al2 Si O5'
_cell_length_a 7.1262
_cell_length_b 7.8520
_cell_length_c 5.5724
_cell_angle_alpha 89.99
_cell_angle_beta 101.11
_cell_angle_gamma 106.03
_cell_volume 293.598
_exptl_crystal_density_diffrn 3.666
_symmetry_space_group_name_H-M 'P -1'
loop_
_space_group_symop_operation_xyz
 'x,y,z'
 '-x,-y,-z'
loop_
_atom_site_label
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Al1 0.32540 0.70400 0.45820
Al2 0.29740 0.69890 0.95050
Al3 0.09980 0.38620 0.64030
Al4 0.11200 0.91750 0.16490
Si1 0.29620 0.06490 0.70660
Si2 0.29100 0.33170 0.18920
O1 0.10950 0.14680 0.12880
O2 0.12300 0.68560 0.18120
O3 0.27470 0.45450 0.95470
O4 0.28310 0.93540 0.93530
O5 0.10840 0.15200 0.66690
O6 0.12190 0.63070 0.63890
O7 0.28220 0.44530 0.42880
O8 0.29150 0.94670 0.46590
O9 0.50080 0.27490 0.24400
O10 0.50150 0.23120 0.75530
loop_
_atom_site_aniso_label
_atom_site_aniso_U_11
_atom_site_aniso_U_22
_atom_site_aniso_U_33
_atom_site_aniso_U_12
_atom_site_aniso_U_13
_atom_site_aniso_U_23
Al1 0.00297 0.00575 0.00649 0.00179 -0.00093 0.00021
Al2 0.00433 0.00460 0.00679 0.00231 -0.00093 -0.00063
Al3 0.00388 0.00431 0.00755 0.00205 -0.00074 0.00000
Al4 0.00411 0.00431 0.00755 0.00205 -0.00074 0.00042
Si1 0.00274 0.00374 0.00664 0.00179 -0.00074 0.00000
Si2 0.00251 0.00403 0.00604 0.00179 -0.00130 -0.00021
O1 0.00502 0.00489 0.00906 0.00179 -0.00130 -0.00042
O2 0.00411 0.00518 0.00664 0.00154 -0.00111 0.00021
O3 0.00547 0.00575 0.00770 0.00205 -0.00093 0.00021
O4 0.00593 0.00489 0.00815 0.00256 0.00019 0.00104
O5 0.00570 0.00546 0.00770 0.00282 0.00000 0.00125
O6 0.00433 0.00546 0.00725 0.00179 -0.00167 -0.00104
O7 0.00616 0.00546 0.00815 0.00231 -0.00037 -0.00042
O8 0.00593 0.00662 0.00710 0.00333 -0.00056 -0.00042
O9 0.00525 0.00633 0.00770 0.00333 -0.00093 0.00021
O10 0.00456 0.00575 0.00830 0.00154 -0.00074 -0.00042`
))


export const sillimaniteData = CIFStringTo3DInfo(`
data_global
_chemical_name_mineral 'Sillimanite'
loop_
_publ_author_name
'Winter J K'
'Ghose S'
_journal_name_full 'American Mineralogist'
_journal_volume 64 
_journal_year 1979
_journal_page_first 573
_journal_page_last 586
_publ_section_title
;
 Thermal expansion and high-temperature crystal chemistry of the Al2SiO5 polymorphs
 T = 25 deg C
;
_database_code_amcsd 0000723
_chemical_formula_sum 'Al2 Si O5'
_cell_length_a 7.4883
_cell_length_b 7.6808
_cell_length_c 5.7774
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_cell_volume 332.294
_exptl_crystal_density_diffrn 3.239
_symmetry_space_group_name_H-M 'P b n m'
loop_
_space_group_symop_operation_xyz
 'x,y,z'
 'x,y,1/2-z'
 '-x,-y,1/2+z'
 '1/2+x,1/2-y,1/2+z'
 '1/2-x,1/2+y,1/2-z'
 '1/2-x,1/2+y,z'
 '1/2+x,1/2-y,-z'
 '-x,-y,-z'
loop_
_atom_site_label
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Al1 0.00000 0.00000 0.00000
Al2 0.14170 0.34490 0.25000
Si 0.15330 0.34020 0.75000
O1 0.36050 0.40940 0.75000
O2 0.35690 0.43410 0.25000
O3 0.47630 0.00150 0.75000
O4 0.12520 0.22300 0.51450
loop_
_atom_site_aniso_label
_atom_site_aniso_U_11
_atom_site_aniso_U_22
_atom_site_aniso_U_33
_atom_site_aniso_U_12
_atom_site_aniso_U_13
_atom_site_aniso_U_23
Al1 0.00256 0.00568 0.00693 -0.00029 0.00000 -0.00022
Al2 0.00341 0.00717 0.00761 -0.00029 0.00000 0.00000
Si 0.00227 0.00568 0.00761 -0.00058 0.00000 0.00000
O1 0.00341 0.00807 0.00930 -0.00146 0.00000 0.00000
O2 0.00341 0.00986 0.00795 -0.00117 0.00000 0.00000
O3 0.00852 0.00986 0.01505 -0.00466 0.00000 0.00000
O4 0.00625 0.00747 0.00744 -0.00146 0.00000 0.00000

`)
