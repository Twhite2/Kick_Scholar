You are working on the KickScholar frontend.

I want you to redesign the landing page into a polished, premium, modern education/academic-intelligence platform.

IMPORTANT:
Do NOT simply tweak the existing hero section.
Treat this as a full landing-page design upgrade while preserving the existing KickScholar identity, color scheme, functionality, routes, authentication behavior, and existing project architecture.

First inspect the existing codebase and understand:
- Framework
- Component structure
- Styling system
- Existing dependencies
- Routing
- Authentication
- Existing reusable components
- Existing ReactBits components/dependencies if already installed

Do not replace working infrastructure unnecessarily.

==================================================
PRODUCT CONTEXT
==================================================

KickScholar helps students discover universities and scholarships they actually qualify for.

The core product proposition is:

"Tell KickScholar about yourself, and it tells you where you can realistically study and what funding opportunities you can pursue."

The platform should communicate that it is NOT just another scholarship listing website.

The important differentiator is:

ACADEMIC PROFILE
        ↓
ELIGIBILITY ANALYSIS
        ↓
UNIVERSITY MATCHES
        ↓
SCHOLARSHIP MATCHES
        ↓
APPLICATION ACTIONS

The landing page should make this concept immediately understandable.

==================================================
CURRENT DESIGN PROBLEM
==================================================

The current landing page is too sparse.

The current hero has:
- Logo
- Login
- Sign up
- Large headline
- Short paragraph
- Two buttons
- Huge amount of empty whitespace

It looks clean but does not communicate enough product value.

I want the new page to feel like a real, funded, modern technology startup — something between:
- Linear
- Notion
- Stripe
- modern edtech platforms
- premium academic/research software

But DO NOT copy any of these websites.

KickScholar should have its own visual identity.

==================================================
COLOR SYSTEM
==================================================

Preserve the existing KickScholar color direction.

Primary:
#211D71

Success:
#00A54F

Destructive/accent:
#ED1D25

Background:
#FFFFFF

Muted background:
#F4F4F8

Border:
#E6E5F0

The screenshot currently uses a blue/green visual identity.

Use:
- Blue for primary actions and intelligence/matching
- Green for successful eligibility / scholarships / qualified states
- Red sparingly for warnings or important exclusions
- White and very light gray for the majority of the UI

Do NOT introduce a completely new color palette.

Do NOT turn the website into a dark-mode-first design.

==================================================
DESIGN PRINCIPLES
==================================================

The site should feel:

- Intelligent
- Trustworthy
- Academic
- Modern
- Calm
- Premium
- Data-driven
- Accessible
- Professional

Avoid:
- excessive gradients
- excessive glassmorphism
- childish education illustrations
- generic stock photography
- cartoon-style graphics
- huge meaningless animations
- excessive rounded cards
- visual clutter
- AI-generated-looking interfaces

The design should have restraint.

==================================================
REACTBITS
==================================================

Use ReactBits components/animations where appropriate.

If ReactBits is already installed, use the existing implementation.

If not installed, install only the components that are actually useful.

Use ReactBits-style interactive visual elements such as:

- Aurora / interactive background
- Particles
- Spotlight
- BlurText
- SplitText
- ScrollReveal
- AnimatedContent
- CountUp
- ShinyText
- interactive cards / magnetic effects where appropriate

Do NOT use every animation simply because it exists.

Animations should communicate something.

For example:

Hero:
- subtle animated background
- animated headline entrance
- floating academic/profile elements
- subtle particle/aurora movement

Feature sections:
- cards reveal as the user scrolls
- numbers count upward
- eligibility states animate into view

CTA:
- subtle hover and entrance animations

The background must remain readable and performant.

==================================================
PAGE STRUCTURE
==================================================

Build the landing page as a complete narrative.

SECTION 1 — NAVIGATION
--------------------------------------------------

Keep a clean top navigation.

Left:
KickScholar logo/wordmark.

Right:
- How it works
- Scholarships
- Universities
- Log in
- Sign up

On mobile:
- responsive navigation
- clean mobile menu

The navbar should remain minimal.

Add subtle backdrop/blur or border behavior when scrolling.

==================================================
SECTION 2 — HERO
==================================================

The hero should be dramatically better than the current one.

Main headline:

"Find universities and scholarships you actually qualify for."

Keep the general meaning of the current headline, but improve the visual hierarchy.

Use selective color emphasis:

"universities and"
"scholarships"
"qualify for"

Use the KickScholar blue and green.

Supporting copy:

"KickScholar matches your academic profile against real, sourced eligibility data — so you can discover opportunities that fit you, understand why you qualify, and know what to do next."

CTA:

Primary:
"Find my matches"

Secondary:
"See how it works"

Below the CTAs, add a small trust/value statement such as:

"Built around your academic profile, not generic search results."

--------------------------------------------------

HERO VISUAL
--------------------------------------------------

Do NOT leave the hero as mostly empty white space.

Create a sophisticated interactive visual on the right side or beneath the headline.

The visual should represent the KickScholar matching engine.

For example:

A floating "Student Profile" card:

Academic Profile
BSc Computer Science
CGPA 3.72 / 5.00
Computer Science
International Student

Then animated connection lines / particles leading toward:

"University Match"
✓ Eligibility confirmed
University of Helsinki
MSc Computer Science

and:

"Scholarship Match"
✓ Eligible
€13,000 / year
Application deadline
12 Oct

The cards should float subtly.

Use ReactBits animation components where suitable.

The visual should make the product understandable without reading the copy.

DO NOT create fake-looking excessive dashboard UI.

Keep it elegant and believable.

==================================================
SECTION 3 — SOCIAL PROOF / PRODUCT SIGNAL
==================================================

Immediately below the hero, add a compact credibility strip.

Example:

"One profile. Thousands of possibilities."

Then lightweight metrics:

Universities tracked
Scholarships tracked
Countries
Eligibility requirements analyzed

Use animated CountUp-style numbers if appropriate.

Do not invent fake numbers.

If real metrics are not available in the codebase, use conceptual labels without fabricated statistics.

For example:

"Universities"
"Scholarships"
"Countries"
"Eligibility criteria"

==================================================
SECTION 4 — THE PROBLEM
==================================================

Introduce the problem KickScholar solves.

Heading:

"Finding opportunities shouldn't feel like detective work."

Explain that students currently have to:
- search dozens of university websites
- interpret complicated eligibility requirements
- compare academic requirements
- manually determine scholarship eligibility
- track deadlines
- figure out what they should apply to

Visually represent this as a messy fragmented process.

Then transition into:

"KickScholar brings it together."

Use a subtle animation showing many fragmented sources converging into one organized profile.

==================================================
SECTION 5 — HOW IT WORKS
==================================================

Create a strong 4-step section.

Heading:

"From your profile to your next opportunity."

Step 01
"Build your profile"

Tell KickScholar about your:
- education
- grades
- field
- nationality
- study level
- preferences

Step 02
"Check your eligibility"

KickScholar compares your profile against sourced university and scholarship requirements.

Step 03
"Explore your matches"

See opportunities categorized into:

✓ Strong match
◐ Possible match
✕ Doesn't qualify

Step 04
"Take action"

See:
- requirements
- deadlines
- funding
- application links
- what you are missing

Make this section interactive.

As the user scrolls, the active step should change.

==================================================
SECTION 6 — PRODUCT PREVIEW
==================================================

This is very important.

Show what the actual KickScholar application/dashboard experience looks like.

Create a large browser/dashboard mockup.

It should contain something like:

"Your Matches"

98 opportunities found

University of Helsinki
MSc Computer Science

92% Match
✓ Academic requirement
✓ Degree requirement
✓ International applicants

Scholarship:
Finland Scholarship

Funding:
Tuition + living support

Deadline:
12 Oct 2026

[View opportunity]

Then additional cards:

"University matches"
"Scholarship matches"
"Needs attention"

This should look like a genuine product interface rather than a generic illustration.

Use subtle hover animation.

==================================================
SECTION 7 — ELIGIBILITY INTELLIGENCE
==================================================

Make this one of the strongest sections.

Heading:

"Don't just find opportunities. Understand why you qualify."

Show a requirement breakdown.

Example:

University requirement

Bachelor's degree in Computer Science
✓ Matched

Minimum GPA
Required: 3.00 / 5.00
Your GPA: 3.72 / 5.00
✓ Matched

English proficiency
IELTS 6.5
⚠ Required

This demonstrates the actual intelligence/value of KickScholar.

The important idea:

Every match should explain WHY.

Use green for satisfied requirements.

Use amber/yellow for incomplete requirements if that color already exists or can be introduced very sparingly.

Use red only for clearly failed requirements.

==================================================
SECTION 8 — SCHOLARSHIP DISCOVERY
==================================================

Create a section explaining that KickScholar doesn't only match universities.

It also finds funding opportunities.

Example cards:

Government Scholarships
University Scholarships
Research Scholarships
Fully Funded Programs

Explain:

"Find funding alongside the degree you're applying for."

Use tasteful icons.

==================================================
SECTION 9 — DATA / TRUST
==================================================

Because eligibility data is central to the product, establish trust.

Heading:

"Eligibility data you can understand."

Explain that KickScholar uses sourced requirements and presents the reasoning behind matches.

Show:

Source
University / Scholarship provider

Requirement
Minimum academic qualification

Last checked
[date]

This section should visually reinforce:

"We don't just tell you that you're eligible. We show you why."

Do not claim verification or real-time updating unless the backend actually supports it.

==================================================
SECTION 10 — FOR STUDENTS WHO KNOW WHAT THEY WANT
==================================================

Create a secondary discovery section.

Examples:

"I want to study AI"
"I want a fully funded Master's"
"I want to study in Europe"
"I want a PhD"
"I want scholarships with no application fee"

These can appear as interactive chips/cards.

Clicking them can either:
- route to the appropriate existing search page
- or remain visual if functionality does not exist

Do not invent routes.

==================================================
SECTION 11 — FINAL CTA
==================================================

End with a strong but simple CTA.

Heading:

"Your next university might already be within reach."

Supporting text:

"Build your profile and discover opportunities matched to you."

Primary CTA:

"Find my matches"

Secondary:

"Explore scholarships"

Use the blue/green brand identity.

Add a subtle animated background treatment here.

==================================================
FOOTER
==================================================

Create a professional footer.

KickScholar

Product:
- Universities
- Scholarships
- How it works

Resources:
- Guides
- Eligibility
- Study destinations

Company:
- About
- Contact

Legal:
- Privacy
- Terms

Do not add links to pages that do not exist unless the project already has routing for them.

==================================================
ANIMATION SYSTEM
==================================================

Animations should feel premium and intentional.

Use:

1. Hero text entrance
   - BlurText / SplitText style reveal
   - fast but subtle

2. Hero visual
   - floating cards
   - subtle movement
   - animated connection/particle effect

3. Scroll animations
   - sections fade/slide in
   - cards stagger slightly

4. Numbers
   - CountUp

5. Hover
   - subtle elevation
   - border highlight
   - tiny transform

6. Buttons
   - subtle hover transitions
   - avoid exaggerated effects

7. Eligibility visualization
   - checkmarks animate in
   - progress bars animate
   - match percentage can count upward

8. Background
   - use ReactBits Aurora/Particles/Spotlight if appropriate

IMPORTANT:
Respect prefers-reduced-motion.

If the user has reduced motion enabled, significantly reduce or disable decorative animations.

==================================================
BACKGROUND DESIGN
==================================================

The background is currently completely white.

Keep the overall page white/light.

However, introduce subtle dynamic visual depth.

Possible implementation:

- very subtle blue/green Aurora behind hero
- low-opacity particles
- soft radial gradients
- subtle grid/dot pattern
- occasional spotlight interaction

The effect should be barely visible behind text.

Do NOT create a distracting animated wallpaper.

The page should still feel professional if animations are disabled.

==================================================
TYPOGRAPHY
==================================================

Use the existing typography if already established.

Otherwise use a modern sans-serif similar to Inter.

Hierarchy should be strong:

Hero:
very large, bold

Section headings:
large and confident

Body:
comfortable reading width

Metadata:
smaller, muted

Use proper line-height and spacing.

Avoid excessive font weights.

==================================================
ICONS
==================================================

Use a consistent icon library already present in the project.

If none exists, use Lucide React.

Use icons for:

- universities
- scholarships
- profile
- eligibility
- requirements
- deadlines
- funding
- search
- check
- warning
- location
- academic degree

Do NOT mix multiple icon styles.

Icons should support the information rather than become decoration.

==================================================
RESPONSIVENESS
==================================================

The page must be excellent on:

- desktop
- laptop
- tablet
- mobile

On mobile:

Hero should stack vertically.

Do not simply shrink the desktop layout.

The product visualization should remain readable.

Animations should be reduced where necessary.

Navigation should become a clean mobile menu.

No horizontal overflow.

==================================================
PERFORMANCE
==================================================

This is important.

Do not sacrifice performance for visual effects.

Avoid:
- unnecessary huge particle counts
- continuous expensive animations
- huge images
- unnecessary libraries
- animation loops that cause excessive CPU usage

Prefer CSS transforms and opacity for animations.

Lazy-load anything that does not need to be loaded immediately.

==================================================
ACCESSIBILITY
==================================================

Maintain:

- semantic HTML
- keyboard navigation
- visible focus states
- accessible buttons
- accessible navigation
- sufficient color contrast
- reduced motion support
- appropriate aria labels where necessary

Do not use animation as the only way to communicate information.

==================================================
IMPORTANT PRODUCT DESIGN RULE
==================================================

The page should tell a story:

1. I have a problem.
2. KickScholar understands the problem.
3. I create my profile.
4. KickScholar evaluates me.
5. I see universities I qualify for.
6. I see scholarships I qualify for.
7. I understand WHY I qualify.
8. I know what to do next.

Every section should contribute to this narrative.

==================================================
VISUAL QUALITY BAR
==================================================

Before finishing, compare the new result mentally against the current screenshot.

The current page is:

[large whitespace]
headline
paragraph
buttons

The new page should feel like:

[interactive hero]
[product concept]
[problem]
[how it works]
[real product preview]
[eligibility intelligence]
[scholarship discovery]
[trust/data]
[CTA]

It should look like a serious startup product that could be shown to:
- students
- universities
- scholarship organizations
- investors

Do not make it look like a template.

==================================================
IMPLEMENTATION REQUIREMENTS
==================================================

Before modifying files:

1. Inspect the existing project.
2. Identify the current landing page entry point.
3. Identify reusable components.
4. Identify existing UI/icon/animation dependencies.
5. Identify existing routing.
6. Identify existing design tokens.

Then implement the redesign.

Create reusable components instead of putting the entire page into one enormous component.

Suggested structure if appropriate:

components/
  landing/
    Navbar
    Hero
    HeroMatchingVisual
    TrustStrip
    ProblemSection
    HowItWorks
    ProductPreview
    EligibilitySection
    ScholarshipSection
    TrustSection
    DiscoverySection
    FinalCTA
    Footer

Use the project's actual architecture if it differs.

Keep content easy to edit.

Do not break authentication.

Do not break existing navigation.

Do not remove existing functionality.

Do not create fake backend functionality.

If a statistic or product capability does not exist, do not fabricate it.

Use realistic placeholder content only where necessary for visual product previews, and clearly keep it as mock UI.

==================================================
FINAL POLISH
==================================================

After implementation:

- Run the application.
- Inspect the page at desktop and mobile widths.
- Fix layout issues.
- Fix animation issues.
- Fix overflow.
- Check console errors.
- Check missing imports.
- Check broken routes.
- Check accessibility issues.
- Check that ReactBits animations actually work.
- Remove unused dependencies/components.
- Ensure the page does not feel over-animated.

Most importantly:

DO NOT stop after making the hero prettier.

I want a complete, high-quality landing page redesign that communicates the KickScholar product clearly and makes the current screenshot feel like an early prototype.

The final result should feel like:

"An intelligent university and scholarship matching platform"

—not:

"another scholarship listing website."