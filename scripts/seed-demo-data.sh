#!/usr/bin/env bash
#
# Fills a local Ivi instance with demo data, through the public API only.
#
# Everything here is fabricated. The names, the readings and the clinical notes were written to
# look plausible on screen; none of it describes a real person. Never point this at an
# environment holding real client records — it creates an account with a published password.
#
#   ./scripts/seed-demo-data.sh [--reset]
#
# See scripts/README.md.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/api.sh
source "$SCRIPT_DIR/lib/api.sh"

EMAIL="${IVI_EMAIL:-ivitester@maildrop.cc}"
PASSWORD="${IVI_PASSWORD:-ivitester@maildrop.cc}"

RESET=false
for arg in "$@"; do
    case "$arg" in
        --reset) RESET=true ;;
        -h|--help)
            sed -n '3,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "Unknown argument: $arg (try --help)" >&2; exit 2 ;;
    esac
done

FAILURES=0
step() { printf '\n\033[1m%s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
fail() { printf '  !! %s\n' "$*" >&2; FAILURES=$((FAILURES + 1)); }

for tool in curl jq; do
    command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 1; }
done

require_server

# ---------------------------------------------------------------------------
# Account
# ---------------------------------------------------------------------------
step "Account"

bootstrap_session

registration=$(api POST /api/v1/practitioner/registration "$(jq -nc \
    --arg e "$EMAIL" --arg p "$PASSWORD" \
    '{email:$e, password:$p, displayName:"Ivi Tester", practiceName:"Ivi Διαιτολογικό Γραφείο"}')")

case "$(api_status)" in
    201) note "registered $EMAIL" ;;
    # Re-running against an account that already exists is the normal case, not an error.
    400|409) note "$EMAIL already exists, reusing it" ;;
    *) echo "  !! registration -> $(api_status) $registration" >&2; exit 1 ;;
esac

login=$(api POST /api/v1/auth/login "$(jq -nc --arg e "$EMAIL" --arg p "$PASSWORD" \
    '{email:$e, password:$p}')")
[ "$(api_status)" = "200" ] || { echo "  !! login -> $(api_status) $login" >&2; exit 1; }
note "signed in as practitioner $(jq -r .id <<<"$login")"

# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------
if [ "$RESET" = true ]; then
    step "Reset"

    # Deleting a client cascades to its measurements, journal entries and plans (the foreign
    # keys are ON DELETE CASCADE), so this is enough to empty the account.
    existing=$(api GET "/api/v1/client?size=200" | jq -r '.content[].id')
    count=0
    for id in $existing; do
        api DELETE "/api/v1/client/$id" > /dev/null
        [ "$(api_status)" = "204" ] || fail "delete client $id -> $(api_status)"
        count=$((count + 1))
    done
    note "deleted $count clients and everything hanging off them"

    # Catalogue foods cannot be deleted, and must not be: they belong to the shared seed.
    # Only the ones this account owns go.
    owned=$(api GET "/api/v1/food?size=200" | jq -r '.content[] | select(.global == false) | .id')
    count=0
    for id in $owned; do
        api DELETE "/api/v1/food/$id" > /dev/null
        [ "$(api_status)" = "204" ] || fail "delete food $id -> $(api_status)"
        count=$((count + 1))
    done
    note "deleted $count practitioner-owned foods"
fi

# ---------------------------------------------------------------------------
# Foods
#
# These four go in before the plans, because a plan below references the trahanas by name.
# ---------------------------------------------------------------------------
step "Practitioner's own foods"

new_food() {
    local body="$1" response
    response=$(api POST /api/v1/food "$body")
    if [ "$(api_status)" != "201" ]; then
        fail "food -> $(api_status) $response"
        return 0
    fi
    note "$(jq -r .nameEl <<<"$response")"
}

new_food '{"nameEl":"Τραχανάς ξινός","nameEn":"Sour trahanas","category":"CARBOHYDRATE",
  "energyKcal":362,"proteinG":13.4,"carbohydrateG":68.2,"fatG":3.1,
  "portions":[{"label":"μερίδα","grams":60,"isDefault":true},
              {"label":"100 γραμμάρια","grams":100,"isDefault":false}]}'

new_food '{"nameEl":"Ανθότυρο","nameEn":"Anthotyro","category":"PROTEIN",
  "energyKcal":186,"proteinG":13.8,"carbohydrateG":3.2,"fatG":13.1,
  "portions":[{"label":"μερίδα","grams":50,"isDefault":true},
              {"label":"100 γραμμάρια","grams":100,"isDefault":false}]}'

new_food '{"nameEl":"Φάβα Σαντορίνης βρασμένη","nameEn":"Split pea puree","category":"PROTEIN",
  "energyKcal":118,"proteinG":7.9,"carbohydrateG":19.4,"fatG":0.8,
  "portions":[{"label":"μερίδα","grams":180,"isDefault":true},
              {"label":"100 γραμμάρια","grams":100,"isDefault":false}]}'

new_food '{"nameEl":"Γίγαντες πλακί","nameEn":"Baked giant beans","category":"COMPOSITE",
  "energyKcal":132,"proteinG":6.1,"carbohydrateG":16.8,"fatG":4.9,
  "portions":[{"label":"μερίδα","grams":200,"isDefault":true},
              {"label":"100 γραμμάρια","grams":100,"isDefault":false}]}'

# Plans below name their foods in Greek rather than by id. Catalogue ids happen to be stable
# because they come from a Flyway seed, but depending on that would break the moment the seed
# is reordered, and it makes the plan definitions unreadable.
FOOD_INDEX="$IVI_WORK_DIR/foods.tsv"
api GET "/api/v1/food?size=500" | jq -r '.content[] | "\(.nameEl)\t\(.id)"' > "$FOOD_INDEX"

food_id() {
    local id
    id=$(awk -F'\t' -v want="$1" '$1 == want { print $2; exit }' "$FOOD_INDEX")
    if [ -z "$id" ]; then
        fail "no food named '$1' in the catalogue"
        return 1
    fi
    printf '%s' "$id"
}

# ---------------------------------------------------------------------------
# Clients
# ---------------------------------------------------------------------------
step "Clients"

new_client() { # full_name email phone date_of_birth goal notes -> id
    local response
    response=$(api POST /api/v1/client "$(jq -nc \
        --arg n "$1" --arg e "$2" --arg p "$3" --arg d "$4" --arg g "$5" --arg o "$6" \
        '{fullName:$n, email:$e, phone:$p, dateOfBirth:$d, goal:$g, notes:$o}')")
    if [ "$(api_status)" != "201" ]; then
        fail "client $1 -> $(api_status) $response"
        return 1
    fi
    jq -r .id <<<"$response"
}

MARIA=$(new_client "Μαρία Παπαδοπούλου" "maria.papadopoulou@maildrop.cc" "+30 694 512 3387" \
    "1990-04-12" "Απώλεια βάρους 8-10 κιλών και σταθεροποίηση" \
    "Καθιστική εργασία (λογίστρια). Ιστορικό γιο-γιο διαιτών. Δυσανεξία στη λακτόζη — αποφυγή φρέσκου γάλακτος, ανέχεται γιαούρτι και σκληρά τυριά.")
note "Μαρία Παπαδοπούλου ($MARIA) — weight loss, the fullest record"

GIORGOS=$(new_client "Γιώργος Αντωνίου" "g.antoniou@maildrop.cc" "+30 697 884 2210" \
    "1985-09-03" "Αύξηση μυϊκής μάζας με ελεγχόμενο λίπος" \
    "Προπόνηση με αντιστάσεις 4x/εβδομάδα. Εργάζεται σε βάρδιες — τα γεύματα μετακινούνται συχνά.")
note "Γιώργος Αντωνίου ($GIORGOS) — lean gain"

ELENI=$(new_client "Ελένη Δημητρίου" "eleni.dimitriou@maildrop.cc" "+30 693 220 7741" \
    "1998-01-27" "Διατροφική υποστήριξη για ημιμαραθώνιο Νοεμβρίου" \
    "Τρέχει 55-70 χλμ/εβδομάδα. Ιστορικό χαμηλής φερριτίνης (2025) — παρακολούθηση.")
note "Ελένη Δημητρίου ($ELENI) — endurance athlete"

NIKOS=$(new_client "Νίκος Καραγιάννης" "n.karagiannis@maildrop.cc" "+30 698 331 5502" \
    "1972-11-15" "Γλυκαιμικός έλεγχος και απώλεια βάρους" \
    "Σακχαρώδης διαβήτης τύπου 2, υπό μετφορμίνη. Παρακολούθηση από ενδοκρινολόγο. HbA1c 7.4% στην έναρξη.")
note "Νίκος Καραγιάννης ($NIKOS) — type 2 diabetes, longest series"

SOFIA=$(new_client "Σοφία Βασιλείου" "sofia.vasileiou@maildrop.cc" "+30 691 447 9963" \
    "2001-06-08" "Ισορροπημένη χορτοφαγική διατροφή" \
    "Ωβογαλακτοχορτοφάγος από το 2023. Φοιτήτρια — περιορισμένος χρόνος μαγειρέματος.")
note "Σοφία Βασιλείου ($SOFIA) — vegetarian"

DIMITRIS=$(new_client "Δημήτρης Ιωάννου" "d.ioannou@maildrop.cc" "+30 694 002 1178" \
    "1965-03-22" "Μείωση LDL χοληστερόλης και περιφέρειας μέσης" \
    "LDL 168 mg/dL στην έναρξη. Σύσταση καρδιολόγου για διατροφική παρέμβαση πριν από φαρμακευτική αγωγή.")
note "Δημήτρης Ιωάννου ($DIMITRIS) — cardiovascular risk"

ANNA=$(new_client "Άννα Στεφανίδου" "anna.stefanidou@maildrop.cc" "+30 695 776 3324" \
    "1993-08-19" "Διατροφή στην εγκυμοσύνη — 2ο τρίμηνο" \
    "Εγκυμοσύνη, 22η εβδομάδα. Πρωινή ναυτία υποχώρησε τον 4ο μήνα. Συμπλήρωμα φυλλικού και σιδήρου από τη μαία.")
note "Άννα Στεφανίδου ($ANNA) — pregnancy, weight rising by design"

KOSTAS=$(new_client "Κώστας Μιχαηλίδης" "k.michailidis@maildrop.cc" "+30 699 118 4407" \
    "1988-12-05" "Διατήρηση βάρους μετά από απώλεια 12 κιλών" \
    "Νέος πελάτης — πρώτο ραντεβού προγραμματισμένο. Δεν έχουν ληφθεί ακόμη μετρήσεις.")
note "Κώστας Μιχαηλίδης ($KOSTAS) — left empty on purpose, for empty states"

# ---------------------------------------------------------------------------
# Measurements
#
# Recorded as dated batches, the way a practitioner enters a full set of readings after a
# consultation. Every series moves in one direction on purpose — a chart of random numbers
# tells you nothing about whether the chart works.
# ---------------------------------------------------------------------------
step "Measurements"

measure() { # client_id date TYPE=VALUE...
    local client="$1" date="$2"
    shift 2

    local values="[]" pair
    for pair in "$@"; do
        values=$(jq -c --arg t "${pair%%=*}" --argjson v "${pair#*=}" \
            '. + [{typeCode:$t, value:$v}]' <<<"$values")
    done

    local response
    response=$(api POST /api/v1/measurement/batch "$(jq -nc \
        --argjson c "$client" --arg d "$date" --argjson v "$values" \
        '{clientId:$c, recordedOn:$d, values:$v}')")
    [ "$(api_status)" = "201" ] || fail "measurements $date -> $(api_status) $response"
}

# Μαρία — 165 cm, eight months of steady loss, monthly visits.
measure "$MARIA" 2026-01-10 HEIGHT=165.0 WEIGHT=86.4 BODY_FAT_PCT=38.2 WAIST=98.0 HIP=112.0 MUSCLE_MASS=48.2
measure "$MARIA" 2026-02-07 WEIGHT=84.9 BODY_FAT_PCT=37.4 WAIST=96.5 HIP=110.5 MUSCLE_MASS=48.4
measure "$MARIA" 2026-03-07 WEIGHT=83.1 BODY_FAT_PCT=36.5 WAIST=94.8 HIP=109.0 MUSCLE_MASS=48.6
measure "$MARIA" 2026-04-04 WEIGHT=81.6 BODY_FAT_PCT=35.6 WAIST=93.0 HIP=107.5 MUSCLE_MASS=48.7
measure "$MARIA" 2026-05-02 WEIGHT=80.4 BODY_FAT_PCT=34.8 WAIST=91.4 HIP=106.2 MUSCLE_MASS=48.9
measure "$MARIA" 2026-05-30 WEIGHT=79.5 BODY_FAT_PCT=34.0 WAIST=90.0 HIP=105.0 MUSCLE_MASS=49.0
measure "$MARIA" 2026-06-27 WEIGHT=78.8 BODY_FAT_PCT=33.3 WAIST=88.6 HIP=104.0 MUSCLE_MASS=49.2
measure "$MARIA" 2026-07-25 WEIGHT=78.2 BODY_FAT_PCT=32.6 WAIST=87.4 HIP=103.2 MUSCLE_MASS=49.3
measure "$MARIA" 2026-08-08 WEIGHT=77.9 BODY_FAT_PCT=32.1 WAIST=86.5 HIP=102.6 MUSCLE_MASS=49.4
note "Μαρία: 9 sessions, weight 86.4 -> 77.9 kg"

# Γιώργος — 182 cm, gaining weight while body fat falls.
measure "$GIORGOS" 2026-03-14 HEIGHT=182.0 WEIGHT=74.2 BODY_FAT_PCT=14.8 MUSCLE_MASS=60.1 CHEST=96.0 ARM=31.5
measure "$GIORGOS" 2026-04-11 WEIGHT=75.6 BODY_FAT_PCT=14.5 MUSCLE_MASS=61.3 CHEST=97.5 ARM=32.2
measure "$GIORGOS" 2026-05-09 WEIGHT=77.1 BODY_FAT_PCT=14.3 MUSCLE_MASS=62.6 CHEST=99.0 ARM=32.9
measure "$GIORGOS" 2026-06-06 WEIGHT=78.4 BODY_FAT_PCT=14.1 MUSCLE_MASS=63.7 CHEST=100.2 ARM=33.4
measure "$GIORGOS" 2026-07-04 WEIGHT=79.6 BODY_FAT_PCT=13.9 MUSCLE_MASS=64.8 CHEST=101.4 ARM=34.0
measure "$GIORGOS" 2026-08-01 WEIGHT=80.5 BODY_FAT_PCT=13.6 MUSCLE_MASS=65.6 CHEST=102.3 ARM=34.5
note "Γιώργος: 6 sessions, weight 74.2 -> 80.5 kg with body fat 14.8 -> 13.6%"

# Ελένη — 170 cm, weight flat while composition shifts. Tests a chart with almost no range.
measure "$ELENI" 2026-04-18 HEIGHT=170.0 WEIGHT=58.4 BODY_FAT_PCT=20.1 MUSCLE_MASS=44.2 BODY_WATER_PCT=56.2 BMR_MEASURED=1385
measure "$ELENI" 2026-05-16 WEIGHT=58.1 BODY_FAT_PCT=19.6 MUSCLE_MASS=44.5 BODY_WATER_PCT=56.5 BMR_MEASURED=1392
measure "$ELENI" 2026-06-13 WEIGHT=57.8 BODY_FAT_PCT=19.2 MUSCLE_MASS=44.8 BODY_WATER_PCT=56.8 BMR_MEASURED=1398
measure "$ELENI" 2026-07-11 WEIGHT=57.5 BODY_FAT_PCT=18.8 MUSCLE_MASS=45.0 BODY_WATER_PCT=57.0 BMR_MEASURED=1402
measure "$ELENI" 2026-08-08 WEIGHT=57.6 BODY_FAT_PCT=18.9 MUSCLE_MASS=45.1 BODY_WATER_PCT=57.1 BMR_MEASURED=1405
note "Ελένη: 5 sessions, weight flat within 0.9 kg"

# Νίκος — 176 cm, the longest run.
measure "$NIKOS" 2026-01-24 HEIGHT=176.0 WEIGHT=98.6 BODY_FAT_PCT=34.5 WAIST=112.0 VISCERAL_FAT=16 NECK=43.0
measure "$NIKOS" 2026-02-21 WEIGHT=96.8 BODY_FAT_PCT=33.8 WAIST=110.0 VISCERAL_FAT=15 NECK=42.5
measure "$NIKOS" 2026-03-21 WEIGHT=95.1 BODY_FAT_PCT=33.0 WAIST=108.0 VISCERAL_FAT=15 NECK=42.2
measure "$NIKOS" 2026-04-18 WEIGHT=93.7 BODY_FAT_PCT=32.3 WAIST=106.0 VISCERAL_FAT=14 NECK=42.0
measure "$NIKOS" 2026-05-16 WEIGHT=92.0 BODY_FAT_PCT=31.6 WAIST=104.0 VISCERAL_FAT=13 NECK=41.6
measure "$NIKOS" 2026-06-13 WEIGHT=90.8 BODY_FAT_PCT=31.0 WAIST=102.5 VISCERAL_FAT=13 NECK=41.3
measure "$NIKOS" 2026-07-11 WEIGHT=89.4 BODY_FAT_PCT=30.3 WAIST=101.0 VISCERAL_FAT=12 NECK=41.0
measure "$NIKOS" 2026-08-08 WEIGHT=88.5 BODY_FAT_PCT=29.8 WAIST=99.5 VISCERAL_FAT=12 NECK=40.8
note "Νίκος: 8 sessions, weight 98.6 -> 88.5 kg, waist 112 -> 99.5 cm"

# Σοφία — 162 cm, a short series. Tests a chart with few points.
measure "$SOFIA" 2026-05-23 HEIGHT=162.0 WEIGHT=54.2 BODY_FAT_PCT=24.6 MUSCLE_MASS=39.1
measure "$SOFIA" 2026-06-20 WEIGHT=54.8 BODY_FAT_PCT=24.2 MUSCLE_MASS=39.6
measure "$SOFIA" 2026-07-18 WEIGHT=55.3 BODY_FAT_PCT=23.9 MUSCLE_MASS=40.0
measure "$SOFIA" 2026-08-15 WEIGHT=55.6 BODY_FAT_PCT=23.7 MUSCLE_MASS=40.3
note "Σοφία: 4 sessions"

# Δημήτρης — 174 cm, irregular six-week gaps. Tests uneven spacing on the x axis.
measure "$DIMITRIS" 2026-02-28 HEIGHT=174.0 WEIGHT=88.2 BODY_FAT_PCT=29.4 WAIST=104.0 BONE_MASS=3.20
measure "$DIMITRIS" 2026-04-11 WEIGHT=86.5 BODY_FAT_PCT=28.6 WAIST=101.5 BONE_MASS=3.20
measure "$DIMITRIS" 2026-05-23 WEIGHT=85.0 BODY_FAT_PCT=27.9 WAIST=99.4 BONE_MASS=3.18
measure "$DIMITRIS" 2026-07-04 WEIGHT=83.6 BODY_FAT_PCT=27.2 WAIST=97.6 BONE_MASS=3.18
measure "$DIMITRIS" 2026-08-15 WEIGHT=82.7 BODY_FAT_PCT=26.8 WAIST=96.2 BONE_MASS=3.17
note "Δημήτρης: 5 sessions at uneven intervals"

# Άννα — 168 cm, the one client whose rising weight is the desired outcome.
measure "$ANNA" 2026-04-04 HEIGHT=168.0 WEIGHT=62.4 BODY_WATER_PCT=54.1
measure "$ANNA" 2026-05-09 WEIGHT=64.1 BODY_WATER_PCT=54.6
measure "$ANNA" 2026-06-13 WEIGHT=66.3 BODY_WATER_PCT=55.2
measure "$ANNA" 2026-07-18 WEIGHT=68.5 BODY_WATER_PCT=55.8
measure "$ANNA" 2026-08-15 WEIGHT=70.2 BODY_WATER_PCT=56.3
note "Άννα: 5 sessions, weight 62.4 -> 70.2 kg"

# ---------------------------------------------------------------------------
# Journal
# ---------------------------------------------------------------------------
step "Journal entries"

journal() { # client_id date title content
    local response
    response=$(api POST /api/v1/journal "$(jq -nc \
        --argjson c "$1" --arg d "$2" --arg t "$3" --arg b "$4" \
        '{clientId:$c, entryDate:$d, title:$t, content:$b}')")
    [ "$(api_status)" = "201" ] || fail "journal $2 -> $(api_status) $response"
}

journal "$MARIA" 2026-01-10 "Πρώτη συνεδρία — λήψη ιστορικού" \
"Λήψη διατροφικού ιστορικού και ανακλήσεως 24ώρου. Παραλείπει συστηματικά το πρωινό και τρώει το κύριο γεύμα μετά τις 22:00. Κατανάλωση αναψυκτικών περίπου 1L/ημέρα.

Στόχος πρώτου μήνα: σταθερό πρωινό και αντικατάσταση αναψυκτικών με ανθρακούχο νερό. Δεν θέτουμε ακόμη θερμιδικό στόχο."

journal "$MARIA" 2026-03-07 "Επανεκτίμηση 2 μηνών" \
"Απώλεια 3.3 κιλών σε δύο μήνες — εντός του επιθυμητού ρυθμού. Το πρωινό έχει εδραιωθεί. Τα αναψυκτικά έχουν μειωθεί σε 2-3/εβδομάδα.

Παραμένει δυσκολία με τα βραδινά τσιμπολογήματα τις ημέρες τηλεργασίας. Συζητήθηκε προετοιμασία σνακ εκ των προτέρων."

journal "$MARIA" 2026-05-02 "Πλατό και προσαρμογή" \
"Ο ρυθμός απώλειας επιβραδύνθηκε, όπως αναμενόταν. Αύξηση πρωτεΐνης στα 1.6 g/kg και προσθήκη περπατήματος 30 λεπτών x4/εβδομάδα.

Ανέφερε βελτίωση στην ποιότητα ύπνου."

journal "$MARIA" 2026-06-27 "Τηλεφωνική επικοινωνία" \
"Σύντομη επικοινωνία μετά από διακοπές. Διατήρησε το βάρος της κατά τη διάρκεια δεκαήμερης απουσίας — σημαντική ένδειξη ότι οι συνήθειες έχουν εδραιωθεί και δεν εξαρτώνται από το πλάνο."

journal "$MARIA" 2026-08-08 "Μετάβαση σε φάση συντήρησης" \
"Συνολική απώλεια 8.5 κιλά. Η περιφέρεια μέσης μειώθηκε κατά 11.5 εκ. Ξεκινά σταδιακή αύξηση θερμίδων κατά 150 kcal/εβδομάδα προς τη συντήρηση.

Επόμενο ραντεβού σε έξι εβδομάδες."

journal "$GIORGOS" 2026-03-14 "Έναρξη — αξιολόγηση προπονητικού φορτίου" \
"Προπόνηση με αντιστάσεις 4 φορές/εβδομάδα, πρόγραμμα άνω/κάτω. Η πρόσληψη πρωτεΐνης εκτιμάται στα 1.1 g/kg — ανεπαρκής για τον στόχο.

Θερμιδικό πλεόνασμα 300 kcal και πρωτεΐνη 1.8 g/kg."

journal "$GIORGOS" 2026-05-09 "Έλεγχος 8 εβδομάδων" \
"Αύξηση 2.9 κιλών με μείωση ποσοστού λίπους — η αναλογία κέρδους είναι ευνοϊκή. Η μυϊκή μάζα αυξήθηκε 2.5 κιλά.

Οι βάρδιες παραμένουν το κύριο εμπόδιο· δουλέψαμε σε δύο εναλλακτικά ωράρια γευμάτων, ένα για πρωινή και ένα για νυχτερινή βάρδια."

journal "$GIORGOS" 2026-08-01 "Ολοκλήρωση φάσης όγκου" \
"Συνολική αύξηση 6.3 κιλά σε 4.5 μήνες, με το ποσοστό λίπους να έχει μειωθεί από 14.8% σε 13.6%. Εξαιρετικό αποτέλεσμα.

Σχεδιασμός σύντομης φάσης συντήρησης 4 εβδομάδων πριν από νέο κύκλο."

journal "$ELENI" 2026-04-18 "Αρχική αξιολόγηση δρομέα" \
"Εβδομαδιαίος όγκος 55-70 χλμ. Η πρόσληψη υδατανθράκων είναι χαμηλή για το φορτίο (περίπου 3.8 g/kg). Ιστορικό χαμηλής φερριτίνης το 2025.

Ζητήθηκε αιματολογικός έλεγχος (φερριτίνη, βιταμίνη D, γενική αίματος)."

journal "$ELENI" 2026-06-13 "Αποτελέσματα εξετάσεων και περιοδισμός" \
"Φερριτίνη 34 ng/mL — χαμηλή αλλά εντός ορίων. Ενισχύθηκαν οι διατροφικές πηγές σιδήρου με ταυτόχρονη πρόσληψη βιταμίνης C.

Εισαγωγή περιοδισμού υδατανθράκων: 6-7 g/kg τις ημέρες μεγάλης διαδρομής, 4 g/kg τις ημέρες αποκατάστασης."

journal "$ELENI" 2026-08-08 "Δοκιμή στρατηγικής αγώνα" \
"Δοκιμάστηκε το πρωτόκολλο τροφοδοσίας σε διαδρομή 18 χλμ: 60 g υδατανθράκων/ώρα. Καλή ανοχή, χωρίς γαστρεντερικά συμπτώματα.

Θα επαναληφθεί σε δύο ακόμη μεγάλες διαδρομές πριν τον αγώνα."

journal "$NIKOS" 2026-01-24 "Πρώτη συνεδρία — παραπομπή ενδοκρινολόγου" \
"ΣΔ τύπου 2 υπό μετφορμίνη 1000mg x2. HbA1c 7.4%. Παραπομπή για διατροφική παρέμβαση.

Οι μετρήσεις γλυκόζης νηστείας κυμαίνονται 130-155 mg/dL. Το βραδινό γεύμα είναι πλούσιο σε επεξεργασμένους υδατάνθρακες."

journal "$NIKOS" 2026-03-21 "Έλεγχος 2 μηνών" \
"Απώλεια 3.5 κιλών. Η γλυκόζη νηστείας έχει πέσει στα 118-130 mg/dL. Ο ίδιος αναφέρει σημαντικά λιγότερη μεταγευματική υπνηλία.

Συνέχιση της κατανομής υδατανθράκων σε τρία γεύματα αντί για συγκέντρωση στο βραδινό."

journal "$NIKOS" 2026-05-16 "Επανάληψη HbA1c" \
"HbA1c 6.8% — μείωση 0.6 μονάδων. Ο ενδοκρινολόγος διατηρεί την ίδια δοσολογία και θα επανεκτιμήσει στους έξι μήνες.

Απώλεια 6.6 κιλών συνολικά. Η περιφέρεια μέσης μειώθηκε 8 εκ."

journal "$NIKOS" 2026-08-08 "Σταθεροποίηση" \
"HbA1c 6.4%. Συνολική απώλεια 10.1 κιλά και 12.5 εκ. στη μέση. Το σπλαχνικό λίπος από επίπεδο 16 σε 12.

Ο στόχος πλέον μετατοπίζεται στη διατήρηση. Παρακολούθηση ανά δίμηνο."

journal "$SOFIA" 2026-05-23 "Αρχική εκτίμηση χορτοφαγικής διατροφής" \
"Ωβογαλακτοχορτοφάγος από διετίας. Η πρόσληψη πρωτεΐνης υπολογίζεται στα 0.9 g/kg — χαμηλή. Ο σίδηρος και η B12 χρήζουν προσοχής.

Δεν λαμβάνει συμπληρώματα. Συστάθηκε B12 και αιματολογικός έλεγχος."

journal "$SOFIA" 2026-07-18 "Πρόοδος" \
"Η πρωτεΐνη έχει ανέβει στα 1.3 g/kg μέσω οσπρίων, γιαουρτιού και αυγών. Η μυϊκή μάζα αυξήθηκε κατά 0.9 κιλά.

Λαμβάνει B12 1000 mcg εβδομαδιαίως. Τα φοιτητικά ωράρια παραμένουν πρόκληση — δουλέψαμε σε συνταγές 15 λεπτών."

journal "$DIMITRIS" 2026-02-28 "Έναρξη — καρδιαγγειακό προφίλ" \
"LDL 168 mg/dL, HDL 41, τριγλυκερίδια 190. Ο καρδιολόγος ζήτησε τρίμηνη διατροφική παρέμβαση πριν εξεταστεί στατίνη.

Υψηλή κατανάλωση κόκκινου κρέατος και αλλαντικών. Ελάχιστη κατανάλωση ψαριού και οσπρίων."

journal "$DIMITRIS" 2026-07-04 "Επανάληψη λιπιδαιμικού" \
"LDL 132 mg/dL — μείωση 36 μονάδων. Τριγλυκερίδια 148. Ο καρδιολόγος ανέβαλε τη φαρμακευτική αγωγή για άλλους τρεις μήνες.

Απώλεια 4.6 κιλών και 6.4 εκ. στη μέση. Τρώει ψάρι δύο φορές την εβδομάδα και όσπρια τρεις."

journal "$ANNA" 2026-04-04 "Πρώτη συνεδρία — 15η εβδομάδα κύησης" \
"Η ναυτία του πρώτου τριμήνου έχει υποχωρήσει. Βάρος προ κύησης 59 κιλά, ΔΜΣ 20.9 — φυσιολογικός.

Στόχος συνολικής αύξησης 11.5-16 κιλά. Λαμβάνει φυλλικό και σίδηρο από τη μαία."

journal "$ANNA" 2026-06-13 "22η εβδομάδα" \
"Αύξηση 3.9 κιλών από την έναρξη — εντός του αναμενόμενου εύρους για το δεύτερο τρίμηνο.

Συζητήθηκαν οι τροφές προς αποφυγή (ωμό ψάρι, μη παστεριωμένα τυριά, αλλαντικά) και η κάλυψη ασβεστίου χωρίς φρέσκο γάλα, το οποίο δεν προτιμά."

journal "$ANNA" 2026-08-15 "31η εβδομάδα" \
"Συνολική αύξηση 7.8 κιλά. Ρυθμός φυσιολογικός. Αναφέρει καούρα το βράδυ — συστάθηκαν μικρότερα και συχνότερα γεύματα και αποφυγή κατάκλισης για δύο ώρες μετά το φαγητό.

Έλεγχος σιδήρου προγραμματισμένος στην 34η εβδομάδα."

note "22 entries across 7 clients"

# ---------------------------------------------------------------------------
# Plans
#
# Portion quantities are counts of the food's default portion, not grams. They were chosen so
# that each issued plan's daily average lands within a few percent of its energy target;
# individual macros are allowed to run over or under, because a UI that only ever renders
# on-target bars has not really been tested.
# ---------------------------------------------------------------------------
step "Plans"

new_plan() { # client_id name kcal protein carb fat basis activity_factor days -> id
    local response
    response=$(api POST /api/v1/plan "$(jq -nc \
        --argjson c "$1" --arg n "$2" --argjson k "$3" --argjson p "$4" --argjson cb "$5" \
        --argjson f "$6" --arg b "$7" --argjson a "$8" --argjson d "$9" \
        '{clientId:$c, name:$n, targetKcal:$k, targetProteinG:$p, targetCarbohydrateG:$cb,
          targetFatG:$f, basis:$b, activityFactor:$a, dayCount:$d}')")
    if [ "$(api_status)" != "201" ]; then
        fail "plan $2 -> $(api_status) $response"
        return 1
    fi
    local id
    id=$(jq -r .id <<<"$response")
    # Cached so add_item can resolve meal ids without a round trip per item. Meal ids do not
    # change as items are added, so the copy taken at creation stays valid.
    printf '%s' "$response" > "$IVI_WORK_DIR/plan-$id.json"
    printf '%s' "$id"
}

add_item() { # plan_id day_index meal_type food_name quantity
    local food meal_id response
    food=$(food_id "$4") || return 0
    meal_id=$(jq -r --argjson d "$2" --arg m "$3" \
        '.days[] | select(.dayIndex == $d) | .meals[] | select(.mealType == $m) | .id' \
        "$IVI_WORK_DIR/plan-$1.json")
    if [ -z "$meal_id" ] || [ "$meal_id" = "null" ]; then
        fail "plan $1 has no $3 on day $2"
        return 0
    fi
    response=$(api POST "/api/v1/plan/$1/meal/$meal_id/item" \
        "$(jq -nc --argjson f "$food" --argjson q "$5" '{foodId:$f, quantity:$q}')")
    [ "$(api_status)" = "200" ] || fail "add $4 to plan $1 -> $(api_status) $response"
}

set_notes() {
    local response; response=$(api PATCH "/api/v1/plan/$1/notes" "$(jq -nc --arg n "$2" '{notes:$n}')")
    [ "$(api_status)" = "200" ] || fail "notes on plan $1 -> $(api_status) $response"
}

set_status() {
    local response; response=$(api PATCH "/api/v1/plan/$1/status" "$(jq -nc --arg s "$2" '{status:$s}')")
    [ "$(api_status)" = "200" ] || fail "status on plan $1 -> $(api_status) $response"
}

# --- Μαρία, a full week. The largest aggregate in the data set. ---
plan=$(new_plan "$MARIA" "Πλάνο απώλειας βάρους — Μάιος" 1650 124 165 55 MIFFLIN_ST_JEOR 1.375 7)
for day in 0 1 2 3 4 5 6; do
    add_item "$plan" "$day" BREAKFAST       "Γιαούρτι στραγγιστό 2%" 1
    add_item "$plan" "$day" BREAKFAST       "Ψωμί ολικής άλεσης"     2
    add_item "$plan" "$day" MORNING_SNACK   "Μήλο"                   1
    add_item "$plan" "$day" LUNCH           "Κοτόπουλο στήθος"       1
    add_item "$plan" "$day" LUNCH           "Ρύζι βρασμένο"          1
    add_item "$plan" "$day" LUNCH           "Χωριάτικη σαλάτα"       1
    add_item "$plan" "$day" LUNCH           "Ελιές"                  8
    add_item "$plan" "$day" AFTERNOON_SNACK "Αμύγδαλα"               20
    add_item "$plan" "$day" DINNER          "Φακές βρασμένες"        1
    add_item "$plan" "$day" DINNER          "Μαρούλι"                1
    add_item "$plan" "$day" DINNER          "Γαρίδες"                1
done
# Variation, so the week is not seven identical rows.
add_item "$plan" 2 BREAKFAST     "Αυγό"      2
add_item "$plan" 3 LUNCH         "Σαρδέλα"   1
add_item "$plan" 4 DINNER        "Φέτα"      1
add_item "$plan" 5 MORNING_SNACK "Μπανάνα"   1
add_item "$plan" 6 DINNER        "Μουσακάς"  1
set_notes "$plan" "Το βραδινό να ολοκληρώνεται έως τις 21:00. Ελαιόλαδο έως 3 κουταλιές την ημέρα συνολικά, συμπεριλαμβανομένου του μαγειρέματος. Νερό τουλάχιστον 2 λίτρα."
set_status "$plan" ISSUED
note "Μαρία: 7-day plan, ISSUED"

# --- Μαρία again, superseded. Gives one client a plan history. ---
plan=$(new_plan "$MARIA" "Πλάνο έναρξης — Ιανουάριος" 1800 108 202 60 MIFFLIN_ST_JEOR 1.2 3)
for day in 0 1 2; do
    add_item "$plan" "$day" BREAKFAST       "Ψωμί ολικής άλεσης"     2
    add_item "$plan" "$day" BREAKFAST       "Γιαούρτι στραγγιστό 2%" 1
    add_item "$plan" "$day" MORNING_SNACK   "Μπανάνα"                1
    add_item "$plan" "$day" LUNCH           "Μακαρόνια βρασμένα"     1
    add_item "$plan" "$day" LUNCH           "Μοσχαρίσιος κιμάς"      1
    add_item "$plan" "$day" LUNCH           "Παξιμάδι κρίθινο"       2
    add_item "$plan" "$day" LUNCH           "Ελαιόλαδο"              1
    add_item "$plan" "$day" AFTERNOON_SNACK "Πορτοκάλι"              1
    add_item "$plan" "$day" DINNER          "Χωριάτικη σαλάτα"       1
    add_item "$plan" "$day" DINNER          "Φακές βρασμένες"        1
done
set_notes "$plan" "Αντικαταστάθηκε από το πλάνο Μαΐου. Διατηρείται ως μέρος του ιστορικού."
set_status "$plan" ARCHIVED
note "Μαρία: 3-day plan, ARCHIVED"

# --- Γιώργος, surplus. Protein deliberately runs past target. ---
plan=$(new_plan "$GIORGOS" "Πλάνο αύξησης μυϊκής μάζας" 3100 145 372 86 MIFFLIN_ST_JEOR 1.725 4)
for day in 0 1 2 3; do
    add_item "$plan" "$day" BREAKFAST       "Αυγό"                 3
    add_item "$plan" "$day" BREAKFAST       "Ψωμί ολικής άλεσης"   3
    add_item "$plan" "$day" MORNING_SNACK   "Μπανάνα"              2
    add_item "$plan" "$day" MORNING_SNACK   "Καρύδια"              1
    add_item "$plan" "$day" LUNCH           "Μοσχαρίσιος κιμάς"    1
    add_item "$plan" "$day" LUNCH           "Μακαρόνια βρασμένα"   3
    add_item "$plan" "$day" LUNCH           "Ρύζι βρασμένο"        1
    add_item "$plan" "$day" LUNCH           "Ελαιόλαδο"            2
    add_item "$plan" "$day" AFTERNOON_SNACK "Μπανάνα"              1
    add_item "$plan" "$day" DINNER          "Κοτόπουλο στήθος"     2
    add_item "$plan" "$day" DINNER          "Γλυκοπατάτα"          1
    add_item "$plan" "$day" DINNER          "Πατάτα βραστή"        2
    add_item "$plan" "$day" DINNER          "Μπρόκολο"             1
done
set_notes "$plan" "Τα δύο γεύματα γύρω από την προπόνηση δεν μετακινούνται. Στη νυχτερινή βάρδια, το πρωινό γίνεται το γεύμα των 15:00 και η σειρά διατηρείται."
set_status "$plan" ISSUED
note "Γιώργος: 4-day plan, ISSUED"

# --- Ελένη, a single day repeated on long-run days. Tests a one-day plan. ---
plan=$(new_plan "$ELENI" "Ημέρα μεγάλης διαδρομής" 2650 92 397 74 HARRIS_BENEDICT 1.9 1)
add_item "$plan" 0 BREAKFAST       "Ψωμί ολικής άλεσης" 3
add_item "$plan" 0 BREAKFAST       "Μπανάνα"            1
add_item "$plan" 0 BREAKFAST       "Παξιμάδι κρίθινο"   2
add_item "$plan" 0 MORNING_SNACK   "Παξιμάδι κρίθινο"   2
add_item "$plan" 0 MORNING_SNACK   "Μπανάνα"            2
add_item "$plan" 0 LUNCH           "Μακαρόνια βρασμένα" 2
add_item "$plan" 0 LUNCH           "Κοτόπουλο στήθος"   1
add_item "$plan" 0 LUNCH           "Ντομάτα"            1
add_item "$plan" 0 LUNCH           "Ελαιόλαδο"          2
add_item "$plan" 0 AFTERNOON_SNACK "Πορτοκάλι"          2
add_item "$plan" 0 AFTERNOON_SNACK "Καρύδια"            5
add_item "$plan" 0 DINNER          "Πατάτα βραστή"      2
add_item "$plan" 0 DINNER          "Σαρδέλα"            1
add_item "$plan" 0 DINNER          "Σπανάκι"            1
set_notes "$plan" "Ισχύει για τις ημέρες με διαδρομή άνω των 15 χλμ. Τροφοδοσία εν κινήσει 60 g υδατανθράκων/ώρα, επιπλέον του πλάνου. Σίδηρος με πηγή βιταμίνης C στο ίδιο γεύμα."
set_status "$plan" ISSUED
note "Ελένη: 1-day plan, ISSUED"

# --- Νίκος, carbohydrate spread across meals rather than banked for the evening. ---
plan=$(new_plan "$NIKOS" "Πλάνο γλυκαιμικού ελέγχου" 1900 133 171 74 MIFFLIN_ST_JEOR 1.375 5)
for day in 0 1 2 3 4; do
    add_item "$plan" "$day" BREAKFAST       "Γιαούρτι στραγγιστό 2%" 1
    add_item "$plan" "$day" BREAKFAST       "Παξιμάδι κρίθινο"       1
    add_item "$plan" "$day" BREAKFAST       "Αυγό"                   2
    add_item "$plan" "$day" MORNING_SNACK   "Πορτοκάλι"              1
    add_item "$plan" "$day" LUNCH           "Ρεβίθια βρασμένα"       1
    add_item "$plan" "$day" LUNCH           "Σπανάκι"                1
    add_item "$plan" "$day" LUNCH           "Ελαιόλαδο"              1
    add_item "$plan" "$day" LUNCH           "Κοτόπουλο στήθος"       1
    add_item "$plan" "$day" LUNCH           "Ψωμί ολικής άλεσης"     2
    add_item "$plan" "$day" AFTERNOON_SNACK "Καρύδια"                1
    add_item "$plan" "$day" AFTERNOON_SNACK "Αμύγδαλα"               15
    add_item "$plan" "$day" DINNER          "Γαρίδες"                1
    add_item "$plan" "$day" DINNER          "Μπρόκολο"               1
    add_item "$plan" "$day" DINNER          "Φακές βρασμένες"        1
    add_item "$plan" "$day" DINNER          "Ελαιόλαδο"              1
done
set_notes "$plan" "Οι υδατάνθρακες κατανέμονται σε τρία γεύματα και δεν συγκεντρώνονται στο βραδινό. Μέτρηση γλυκόζης νηστείας κάθε πρωί και δύο ώρες μετά το κύριο γεύμα δύο φορές την εβδομάδα."
set_status "$plan" ISSUED
note "Νίκος: 5-day plan, ISSUED"

# --- Σοφία, left as a draft at roughly three quarters of target. A plan mid-construction is
#     a state the UI has to render, and this is the only one in that state. ---
plan=$(new_plan "$SOFIA" "Χορτοφαγικό πλάνο — προσχέδιο" 2050 82 267 68 MIFFLIN_ST_JEOR 1.55 2)
for day in 0 1; do
    add_item "$plan" "$day" BREAKFAST "Γιαούρτι στραγγιστό 2%" 1
    add_item "$plan" "$day" BREAKFAST "Ψωμί ολικής άλεσης"     2
    add_item "$plan" "$day" BREAKFAST "Τραχανάς ξινός"         1
    add_item "$plan" "$day" LUNCH     "Φακές βρασμένες"        1
    add_item "$plan" "$day" LUNCH     "Ρύζι βρασμένο"          1
    add_item "$plan" "$day" LUNCH     "Ελαιόλαδο"              1
    add_item "$plan" "$day" DINNER    "Ρεβίθια βρασμένα"       1
    add_item "$plan" "$day" DINNER    "Χωριάτικη σαλάτα"       1
done
set_notes "$plan" "Προσχέδιο — εκκρεμεί ο έλεγχος επάρκειας σιδήρου και ψευδαργύρου πριν δοθεί στην πελάτισσα."
note "Σοφία: 2-day plan, DRAFT and deliberately incomplete"

# --- Δημήτρης, cardioprotective. ---
plan=$(new_plan "$DIMITRIS" "Καρδιοπροστατευτικό πλάνο" 1950 117 195 76 MIFFLIN_ST_JEOR 1.375 3)
for day in 0 1 2; do
    add_item "$plan" "$day" BREAKFAST       "Ψωμί ολικής άλεσης"     2
    add_item "$plan" "$day" BREAKFAST       "Ελαιόλαδο"              1
    add_item "$plan" "$day" BREAKFAST       "Γιαούρτι στραγγιστό 2%" 1
    add_item "$plan" "$day" MORNING_SNACK   "Αχλάδι"                 1
    add_item "$plan" "$day" LUNCH           "Σαρδέλα"                4
    add_item "$plan" "$day" LUNCH           "Ρύζι βρασμένο"          1
    add_item "$plan" "$day" LUNCH           "Μπρόκολο"               1
    add_item "$plan" "$day" LUNCH           "Ρεβίθια βρασμένα"       1
    add_item "$plan" "$day" AFTERNOON_SNACK "Αμύγδαλα"               21
    add_item "$plan" "$day" DINNER          "Φακές βρασμένες"        1
    add_item "$plan" "$day" DINNER          "Ντομάτα"                1
    add_item "$plan" "$day" DINNER          "Γαρίδες"                1
    add_item "$plan" "$day" DINNER          "Ελαιόλαδο"              1
done
set_notes "$plan" "Ψάρι τουλάχιστον δύο φορές την εβδομάδα, όσπρια τρεις. Κόκκινο κρέας έως μία φορά. Χωρίς αλλαντικά. Το ελαιόλαδο παραμένει, ωμό κατά προτίμηση."
set_status "$plan" ISSUED
note "Δημήτρης: 3-day plan, ISSUED"

# --- Άννα, second trimester. ---
plan=$(new_plan "$ANNA" "Πλάνο 2ου τριμήνου" 2300 98 288 80 MIFFLIN_ST_JEOR 1.375 3)
for day in 0 1 2; do
    add_item "$plan" "$day" BREAKFAST       "Γιαούρτι στραγγιστό 2%" 1
    add_item "$plan" "$day" BREAKFAST       "Ψωμί ολικής άλεσης"     2
    add_item "$plan" "$day" BREAKFAST       "Πορτοκάλι"              1
    add_item "$plan" "$day" MORNING_SNACK   "Γραβιέρα"               1
    add_item "$plan" "$day" MORNING_SNACK   "Καρύδια"                4
    add_item "$plan" "$day" LUNCH           "Κοτόπουλο στήθος"       1
    add_item "$plan" "$day" LUNCH           "Πατάτα βραστή"          2
    add_item "$plan" "$day" LUNCH           "Σπανάκι"                1
    add_item "$plan" "$day" LUNCH           "Ρύζι βρασμένο"          1
    add_item "$plan" "$day" LUNCH           "Ελαιόλαδο"              2
    add_item "$plan" "$day" AFTERNOON_SNACK "Μπανάνα"                2
    add_item "$plan" "$day" AFTERNOON_SNACK "Μήλο"                   1
    add_item "$plan" "$day" DINNER          "Φακές βρασμένες"        1
    add_item "$plan" "$day" DINNER          "Φέτα"                   1
    add_item "$plan" "$day" DINNER          "Αγγούρι"                1
done
set_notes "$plan" "Χωρίς ωμό ψάρι, μη παστεριωμένα τυριά και αλλαντικά. Η φέτα να είναι από παστεριωμένο γάλα. Μικρότερα και συχνότερα γεύματα λόγω καούρας — το βραδινό έως τις 20:30."
set_status "$plan" ISSUED
note "Άννα: 3-day plan, ISSUED"

# ---------------------------------------------------------------------------
# Catalogue suggestion
# ---------------------------------------------------------------------------
step "Catalogue suggestion"

# Suggestions survive --reset: they belong to the catalogue rather than to a client, and the API
# has no endpoint that deletes one. Creating this unconditionally therefore left an extra copy
# behind on every run, so check first.
yogurt_id=$(food_id "Γιαούρτι στραγγιστό 2%")
already=$(api GET "/api/v1/food/suggestion?size=200" \
    | jq --argjson f "$yogurt_id" '[.content[] | select(.foodId == $f)] | length')

if [ "${already:-0}" -gt 0 ]; then
    note "suggestion already present from an earlier run, left alone"
else
    suggestion=$(api POST "/api/v1/food/$yogurt_id/suggestion" '{
      "proposedEnergyKcal": 66,
      "proposedProteinG": 10.2,
      "rationale": "Οι τιμές του καταλόγου φαίνεται να αφορούν στραγγιστό 4%. Για το 2% της αγοράς, οι ετικέτες τριών εμπορικών σημάτων συγκλίνουν στα 66 kcal και 10.2 g πρωτεΐνης ανά 100 g."
    }')
    if [ "$(api_status)" = "201" ]; then
        note "one suggestion against the catalogue yogurt"
    else
        fail "suggestion -> $(api_status) $suggestion"
    fi
fi

# ---------------------------------------------------------------------------
# Verification
#
# Reading the data back through the API is the only proof that it is actually there and shaped
# the way the UI will receive it.
# ---------------------------------------------------------------------------
step "Verification"

# printf's %-20s pads to a byte count, and Greek is two bytes per character in UTF-8, so every
# name in these tables would be indented differently. ${#s} counts characters, so pad by hand.
column() { # text width
    local text="$1" width="$2" length=${#1}
    printf '%s' "$text"
    while [ "$length" -lt "$width" ]; do printf ' '; length=$((length + 1)); done
}

column "CLIENT" 24; printf '%9s %8s %6s\n' "MEASURED" "JOURNAL" "PLANS"
for client in "$MARIA" "$GIORGOS" "$ELENI" "$NIKOS" "$SOFIA" "$DIMITRIS" "$ANNA" "$KOSTAS"; do
    name=$(api GET "/api/v1/client/$client" | jq -r .fullName)
    measurements=$(api GET "/api/v1/measurement?clientId=$client&size=1" | jq -r .totalElements)
    entries=$(api GET "/api/v1/journal?clientId=$client&size=1" | jq -r .totalElements)
    plans=$(api GET "/api/v1/plan?clientId=$client&size=1" | jq -r .totalElements)
    column "$name" 24; printf '%9s %8s %6s\n' "$measurements" "$entries" "$plans"
done

echo
column "PLAN" 32; printf '%-9s %7s %7s %7s %7s\n' "STATUS" "KCAL" "P" "C" "F"
for id in $(api GET "/api/v1/plan?size=50" | jq -r '.content[].id'); do
    body=$(api GET "/api/v1/plan/$id")
    column "$(jq -r .name <<<"$body")" 32
    printf '%-9s %6s%% %6s%% %6s%% %6s%%\n' \
        "$(jq -r .status <<<"$body")" \
        "$(jq -r .dailyAveragePercent.energyKcal <<<"$body")" \
        "$(jq -r .dailyAveragePercent.proteinG <<<"$body")" \
        "$(jq -r .dailyAveragePercent.carbohydrateG <<<"$body")" \
        "$(jq -r .dailyAveragePercent.fatG <<<"$body")"
done

step "Done"
if [ "$FAILURES" -gt 0 ]; then
    echo "  $FAILURES call(s) failed — the data above is incomplete." >&2
    exit 1
fi
echo "  Sign in at $BASE_URL as $EMAIL"
