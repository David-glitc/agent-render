"""Original deterministic 120 BPM electronic sonic identity. No samples."""
from pathlib import Path
import wave
import numpy as np
SR = 48000
DURATION = 4
N = SR * DURATION
mix = np.zeros((N, 2), dtype=np.float64)
rng = np.random.default_rng(2046)

def place(signal, at, gain=1, pan=0):
    start = round(at*SR)
    count = min(len(signal), N-start)
    if count <= 0: return
    gains = np.array([np.sqrt((1-pan)/2), np.sqrt((1+pan)/2)])
    mix[start:start+count] += signal[:count,None]*gains[None,:]*gain

def pluck(at, freq, gain=.22, pan=0, length=.6):
    t=np.arange(round(length*SR))/SR
    # A low-pass shaped saw spectrum, detuned second voice, quick softened attack.
    sig=np.zeros_like(t)
    for h in range(1,9):
        sig += np.sin(2*np.pi*freq*h*t)*np.exp(-t*(4+h*1.4))/(h**1.5)
        sig += .25*np.sin(2*np.pi*freq*1.004*h*t)*np.exp(-t*(5+h*1.7))/(h**1.5)
    sig *= (1-np.exp(-t*650))*(1-np.clip((t-length+.08)/.08,0,1))
    place(sig,at,gain,pan)
    place(sig,at+.1875,gain*.21,-pan)
    place(sig,at+.375,gain*.1,pan)

def kick(at,gain=.7):
    t=np.arange(round(.34*SR))/SR
    phase=2*np.pi*(47*t+100*.022*(1-np.exp(-t/.022)))
    sig=np.sin(phase)*np.exp(-t*14)*(1-np.exp(-t*1100))
    click=rng.normal(0,1,len(t))*np.exp(-t*310)*.12
    place(sig+click,at,gain)

def hat(at,gain=.055,pan=0):
    t=np.arange(round(.09*SR))/SR
    noise=rng.normal(0,1,len(t))
    high=noise-np.roll(noise,1)
    place(high*np.exp(-t*70)*(1-np.exp(-t*1800)),at,gain,pan)

# A short C-minor phrase, designed as a 4-second sting, not an extracted loop.
for beat in [0,.5,1,1.5,2]: kick(beat,.64 if beat!=2 else .82)
for idx,at in enumerate(np.arange(.25,2.26,.25)):
    hat(float(at),.04 if idx%2==0 else .055,(-1)**idx*.45)
for at,freq,gain,pan in [(0,130.813,.28,-.25),(.25,261.626,.17,.3),(.5,195.998,.25,.2),(.75,311.127,.18,-.3),(1,261.626,.28,-.2),(1.25,391.995,.22,.3),(1.5,311.127,.27,.1),(1.75,466.164,.2,-.35)]:
    pluck(at,freq,gain,pan)
# Final coherent chord and sub; the release remains audible through the hold.
for freq,pan in [(130.813,-.15),(261.626,-.35),(311.127,.1),(391.995,.4),(523.251,0)]:
    pluck(2,freq,.22 if freq<200 else .13,pan,1.85)
# Airy pre-impact lift, band limited noise with a rising pitch component.
t=np.arange(round(.48*SR))/SR
noise=rng.normal(0,1,len(t)); high=(noise-np.roll(noise,1))*.2
riser=(high+np.sin(2*np.pi*(350*t+1300*t*t))*.13)*(t/.48)**2
place(riser,1.51,.14)
# Short final closure accent, then a musical decay rather than a hard mute.
kick(2.5,.28)
pluck(2.5,523.251,.095,.3,1.3)
# Final tonic, synced to the settled identity at 3.0 seconds.
pluck(3,261.626,.13,-.15,.92)
pluck(3,523.251,.07,.25,.92)
# Soft saturation + bounded peak + tiny endpoint fades.
mix=np.tanh(mix*1.15)
mix *= .84/max(float(np.max(np.abs(mix))),.001)
fadein=np.minimum(np.arange(N)/(SR*.003),1)
fadeout=np.minimum((N-1-np.arange(N))/(SR*.14),1)
mix *= (fadein*fadeout)[:,None]
path=Path(__file__).resolve().parents[1]/'assets/audio/teaser-sting.wav'
with wave.open(str(path),'wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR)
    f.writeframes((mix*32767).astype('<i2').tobytes())
print(path)
print('peak_dbfs',round(20*np.log10(np.max(np.abs(mix))),2),'rms_dbfs',round(20*np.log10(np.sqrt(np.mean(mix**2))),2))
