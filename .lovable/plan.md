# Plan: Fler inferensmotorer för garage

## Mål
Stödja de åtta tillåtna mesh-portarna genom en gemensam backendregel, utöka operatörsguiden med sex officiella och fyra övriga runtime-val samt visa konsekventa runtime-namn i garagevyerna.

## Genomförande
- Flytta portlistan till en delad garagekonfiguration och låt både registrering och heartbeat använda samma validering.
- Utöka runtime-modellen med etikett, port, grupp, Beta-status, beskrivning och krav på runtime-nyckel.
- Visa Ollama, LM Studio, llama.cpp, vLLM, SGLang och Paddock direkt; lägg Unsloth, MLX, Lemonade och annan OpenAI-kompatibel server under en hopfälld sektion.
- För `other` låter guiden operatören välja port 8000 eller 8080.
- Lägg in de angivna förberedelsekommandona, OS-anpassad Ollama-hjälp och rekommendationen `OLLAMA_NUM_PARALLEL=4`.
- Generera `--runtime-api-key <DIN_NYCKEL>` för vLLM, SGLang, Paddock, Unsloth och Lemonade. Paddock markeras som obligatorisk; övriga som valfria.
- Återanvänd en gemensam namnformatterare i operatörs- och adminvyer, exempelvis `Paddock (beta)`.
- Distribuera registrering, heartbeat och andra funktioner som importerar den ändrade delade registreringstjänsten.

## Verifiering
- Kontrollera alla runtime-val, portvalet för `other`, instruktioner och genererade kommandon i webbläsaren.
- Kontrollera att backend accepterar exakt de åtta portarna och fortsatt avvisar andra.
- Kontrollera bygge och runtime-fel efter distribution.
