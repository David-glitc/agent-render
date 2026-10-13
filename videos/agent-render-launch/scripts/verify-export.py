"""Verify the delivered master and write an inspectable contact sheet."""
from pathlib import Path
import hashlib, json, subprocess, tempfile
from PIL import Image, ImageDraw
import numpy as np
root=Path(__file__).resolve().parents[1]
video=root/'renders/video.mp4'
def run(args): return subprocess.run(args,check=True,capture_output=True,text=True)
probe=json.loads(run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)]).stdout)
v=next(s for s in probe['streams'] if s['codec_type']=='video')
a=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert float(probe['format']['duration'])==4, probe['format']['duration']
assert (v['width'],v['height'],v['nb_frames'],v['r_frame_rate'])==(1600,900,'120','30/1'),v
assert a['codec_name']=='aac',a
run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'])
volume=run(['ffmpeg','-hide_banner','-i',str(video),'-af','volumedetect','-vn','-f','null','-']).stderr
loudness=run(['ffmpeg','-hide_banner','-i',str(video),'-af','ebur128=peak=true','-vn','-f','null','-']).stderr
samples=[0,.25,.5,.85,1.15,1.5,1.8,2.05,2.3,2.65,3.1,3.8]
sheet=Image.new('RGB',(1600,3*258),'#141414')
with tempfile.TemporaryDirectory(prefix='teaser-proof-') as td:
    for i,t in enumerate(samples):
        out=Path(td)/f'{i}.png'
        run(['ffmpeg','-v','error','-ss',str(t),'-i',str(video),'-frames:v','1','-y',str(out)])
        im=Image.open(out).convert('RGB')
        if i == 0:
            pixels=np.asarray(im)
            blue=(pixels[:,:,2]>150)&(pixels[:,:,0]<90)&(pixels[:,:,1]<145)
            openingBlueFraction=float(blue.mean())
            assert .002 < openingBlueFraction < .045, f'Opening geometry initialization flash: {openingBlueFraction}'
        im.thumbnail((400,225))
        sheet.paste(im,((i%4)*400,(i//4)*258))
        ImageDraw.Draw(sheet).text(((i%4)*400+12,(i//4)*258+233),f'{t:.2f}s',fill='white')
sheet.save(root/'renders/proof-sheet.jpg',quality=95)
run(['ffmpeg','-v','error','-ss','3.2','-i',str(video),'-frames:v','1','-q:v','2','-y',str(root/'renders/poster.jpg')])
summary={'durationSeconds':4,'width':1600,'height':900,'frames':120,'fps':30,'videoCodec':v['codec_name'],'pixelFormat':v['pix_fmt'],'audioCodec':a['codec_name'],'audioSampleRate':a['sample_rate'],'audioChannels':a['channels'],'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'decode':'passed','openingBlueFraction':openingBlueFraction,'proofTimes':samples,'audioVerification':{'volume': '\n'.join(x for x in volume.splitlines() if 'volume:' in x),'loudness':loudness.split('Summary:')[-1]},'description':'Black and electric-blue geometric motion teaser with original musical electronic sting. No narration or explanation.'}
(root/'renders/verification.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
