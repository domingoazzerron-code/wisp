/**
 * Tips view (step 7f): static craving advice (legacy #v-tips).
 */
export function Tips() {
  return (
    <section class="view" id="v-tips">
      <details class="card tipg" open>
        <summary>The 4 D’s</summary>
        <div class="li">
          <b>Delay</b>
          <p>Most cravings fade in 5 to 10 minutes. Start the timer on Today.</p>
        </div>
        <div class="li">
          <b>Deep breaths</b>
          <p>In for 4 seconds, hold for 4, out for 6. Repeat five times.</p>
        </div>
        <div class="li">
          <b>Drink water</b>
          <p>Sip a full glass slowly. It keeps your hands and mouth busy.</p>
        </div>
        <div class="li">
          <b>Do something else</b>
          <p>Take a short walk, wash your face, chew gum, or message a friend.</p>
        </div>
      </details>

      <details class="card tipg">
        <summary>Support makes it easier</summary>
        <div class="li">
          <b>Talk to a professional</b>
          <p>
            A doctor or pharmacist can go through nicotine replacement and other options, which improve your chances of
            quitting.
          </p>
        </div>
        <div class="li">
          <b>Try a quitline</b>
          <p>Many countries run a free quitline. Search for the one in your area.</p>
        </div>
        <div class="li">
          <b>Tell someone</b>
          <p>One friend who knows your plan can make a hard day easier.</p>
        </div>
      </details>

      <details class="card tipg">
        <summary>Common triggers</summary>
        <div class="li">
          <b>After meals</b>
          <p>Brush your teeth right after eating, or leave the table.</p>
        </div>
        <div class="li">
          <b>Coffee</b>
          <p>Switch to tea for a week, or change when you have your coffee.</p>
        </div>
        <div class="li">
          <b>Stress</b>
          <p>Step outside for a minute and breathe before you decide.</p>
        </div>
        <div class="li">
          <b>Social</b>
          <p>Tell friends you are cutting down and ask them not to offer.</p>
        </div>
      </details>
    </section>
  );
}
