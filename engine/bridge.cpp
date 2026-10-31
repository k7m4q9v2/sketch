// Web adapter for LumaFont 0.2.11. The vendored tsf.h and LumaDsp.h are unchanged.
// Voice setup, ROM filtering, custom amp envelope and 3 ms release protection
// are adapted from LumaFont's Plugin.cpp; the FL/Win32 host layer is replaced.
#define TSF_IMPLEMENTATION
#define TSF_NO_STDIO
#include "tsf.h"
#include "LumaDsp.h"
#include <cstdlib>
#include <cstring>
#define API(name) extern "C" __attribute__((export_name(#name)))
constexpr int MAX_FONTS=16, MAX_CHANNELS=16, MAX_SLOTS=128, BLOCK=128;
struct Channel { int font=-1, preset=0; float cents=0,volume=.75f,pan=0,a=.005f,d=.2f,s=.75f,r=.25f,delay=0,hold=0,ca=0,cd=0,cr=0,clock=1; bool custom=true; };
struct Slot { int handle=0,channel=0,font=0,key=60; bool released=false,rendered=false,custom=true; float pitch=0,targetPitch=0,glide=0,gain=0,releaseRate=0; luma::Envelope env; };
static tsf* fonts[MAX_FONTS]={};
static Channel channels[MAX_CHANNELS];
static Slot slots[MAX_SLOTS];
static float output[BLOCK*2],sampleRate=44100;
static int serial=0;static float masterPitch=0;
static void kill(int i){ auto& s=slots[i]; if(!s.handle)return;auto* f=fonts[s.font];if(f)for(int v=0;v<f->voiceNum;v++)if(f->voices[v].playingPreset!=-1&&f->voices[v].playingChannel==i)tsf_voice_kill(&f->voices[v]);s=Slot{}; }
API(alloc) void* alloc(int size){ return size>0?malloc(size):nullptr; }
API(dealloc) void dealloc(void* ptr){free(ptr);}
API(init) void init(float rate){sampleRate=rate;}
API(panic) void panic(int channel){for(int i=0;i<MAX_SLOTS;i++)if(channel<0||slots[i].channel==channel)kill(i);}
API(unload_font) void unload_font(int index){if(index<0||index>=MAX_FONTS)return;for(int i=0;i<MAX_SLOTS;i++)if(slots[i].font==index)kill(i);if(fonts[index])tsf_close(fonts[index]);fonts[index]=nullptr;}
API(load_font) int load_font(int index,const void* bytes,int length){
    if(index<0||index>=MAX_FONTS||length<12)return -1;
    tsf* f=tsf_load_memory(bytes,length);if(!f||f->presetNum<1){if(f)tsf_close(f);return -2;}
    int valid=0;
    for(int i=0;i<f->presetNum;i++){auto& p=f->presets[i];int count=0;for(int j=0;j<p.regionNum;j++){auto r=p.regions[j];if(r.sample_type&0x8000)continue;if(r.offset>=r.end||r.sample_rate==0){tsf_close(f);return -3;}p.regions[count++]=r;}p.regionNum=count;valid+=count>0;}
    if(!valid){tsf_close(f);return -4;}
    tsf_set_output(f,TSF_STEREO_INTERLEAVED,int(sampleRate),-3);
    if(!tsf_set_max_voices(f,256)||!tsf_channel_set_presetindex(f,MAX_SLOTS-1,0)){tsf_close(f);return -5;}
    unload_font(index);fonts[index]=f;return f->presetNum;
}
API(preset_count) int preset_count(int f){return f>=0&&f<MAX_FONTS&&fonts[f]?fonts[f]->presetNum:0;}
API(preset_name) const char* preset_name(int f,int p){return tsf_get_presetname(fonts[f],p);}
API(preset_bank) int preset_bank(int f,int p){return fonts[f]->presets[p].bank;}
API(preset_program) int preset_program(int f,int p){return fonts[f]->presets[p].preset;}
API(preset_playable) int preset_playable(int f,int p){return fonts[f]->presets[p].regionNum>0;}
API(configure) void configure(int c,int f,int bank,int program,float vol,float pan,float a,float d,float s,float r,int custom,float delay,float hold,float ca,float cd,float cr,float clock){
    if(c<0||c>=MAX_CHANNELS)return;auto& ch=channels[c];ch.font=f;ch.preset=f>=0&&f<MAX_FONTS&&fonts[f]?tsf_get_presetindex(fonts[f],bank,program):-1;
    ch.volume=luma::clamp(vol,0,1);ch.pan=luma::clamp(pan,-1,1);ch.a=luma::clamp(a,0,8);ch.d=luma::clamp(d,0,8);ch.s=luma::clamp(s,0,1);ch.r=luma::clamp(r,0,8);ch.custom=custom!=0;ch.delay=luma::clamp(delay,0,4);ch.hold=luma::clamp(hold,0,4);ch.ca=luma::clamp(ca,-1,1);ch.cd=luma::clamp(cd,-1,1);ch.cr=luma::clamp(cr,-1,1);ch.clock=luma::clamp(clock,.25f,2.5f);
}
API(set_pitch) void set_pitch(float pitch){masterPitch=luma::clamp(pitch,-25,25);for(int i=0;i<MAX_SLOTS;i++)if(slots[i].handle&&fonts[slots[i].font])tsf_channel_set_tuning(fonts[slots[i].font],i,masterPitch+channels[slots[i].channel].cents/100+slots[i].pitch);}
API(tune_channel) void tune_channel(int channel,float cents){if(channel<0||channel>=MAX_CHANNELS)return;channels[channel].cents=luma::clamp(cents,-100,100);for(int i=0;i<MAX_SLOTS;i++)if(slots[i].handle&&slots[i].channel==channel)tsf_channel_set_tuning(fonts[slots[i].font],i,masterPitch+channels[channel].cents/100+slots[i].pitch);}
API(note_pitch) float note_pitch(int handle){for(auto& s:slots)if(s.handle==handle)return s.key+s.pitch;return -1;}
API(active_voices) int active_voices(){int count=0;for(auto& s:slots)if(s.handle)count++;return count;}
API(slide_note) void slide_note(int handle,float target,int frames){for(auto& s:slots)if(s.handle==handle&&!s.released){s.targetPitch=target-s.key;s.glide=std::max(1,frames);}}
API(note_on) int note_on(int channel,int key,float velocity){
    if(channel<0||channel>=MAX_CHANNELS||key<0||key>127)return 0;auto& c=channels[channel];if(c.font<0||c.font>=MAX_FONTS||!fonts[c.font]||c.preset<0)return 0;
    int i=0;for(;i<MAX_SLOTS;i++)if(!slots[i].handle)break;if(i==MAX_SLOTS){i=0;for(int j=1;j<MAX_SLOTS;j++)if(slots[j].handle<slots[i].handle)i=j;kill(i);}
    auto& s=slots[i];s=Slot{};s.handle=++serial;s.channel=channel;s.font=c.font;s.key=key;s.custom=c.custom;s.env.on();s.gain=c.volume*(s.custom?s.env.advance(0,c.a,c.d,c.s,c.r,c.delay,c.hold,c.ca,c.cd,c.cr):1);
    auto* f=fonts[s.font];tsf_channel_set_presetindex(f,i,c.preset);tsf_channel_set_tuning(f,i,masterPitch+c.cents/100);tsf_channel_set_pan(f,i,.5f+c.pan*.5f);tsf_channel_set_volume(f,i,1);tsf_channel_note_on(f,i,key,luma::clamp(velocity,0,1));
    if(s.custom){tsf_envelope constant={0,0,0,0,1,0,0,0};for(int j=0;j<f->voiceNum;j++){auto& v=f->voices[j];if(v.playingPreset!=-1&&v.playingChannel==i)tsf_voice_envelope_setup(&v.ampenv,&constant,key,127,TSF_TRUE,sampleRate);}}
    return s.handle;
}
API(note_off) void note_off(int handle){
    for(int i=0;i<MAX_SLOTS;i++){auto& s=slots[i];if(!handle||s.handle!=handle||s.released)continue;s.released=true;if(!s.rendered)s.gain=0;s.releaseRate=s.gain/.003f;s.env.off();auto* f=fonts[s.font];if(!s.custom)tsf_channel_note_off(f,i,s.key);
        else if(channels[s.channel].r>.003f*channels[s.channel].clock)for(int j=0;j<f->voiceNum;j++){auto& v=f->voices[j];if(v.playingPreset!=-1&&v.playingChannel==i&&v.region->loop_mode==TSF_LOOPMODE_SUSTAIN)v.loopEnd=v.loopStart;}
    }
}
API(render) float* render(int frames){
    frames=std::clamp(frames,0,BLOCK);std::fill(output,output+frames*2,0.f);float gains[MAX_SLOTS][32],voiceAudio[64];
    for(int offset=0;offset<frames;offset+=32){int n=std::min(32,frames-offset);
        for(int i=0;i<MAX_SLOTS;i++){auto& s=slots[i];if(!s.handle)continue;auto& c=channels[s.channel];if(s.glide>0){float count=std::min(float(n),s.glide);s.pitch+=(s.targetPitch-s.pitch)*count/s.glide;s.glide-=count;tsf_channel_set_tuning(fonts[s.font],i,masterPitch+c.cents/100+s.pitch);}float env=s.env.advance(n/sampleRate*c.clock,c.a,c.d,c.s,c.r,c.delay,c.hold,c.ca,c.cd,c.cr);tsf_channel_set_pan(fonts[s.font],i,.5f+c.pan*.5f);float target=c.volume*(s.custom?env:1),step=(target-s.gain)/n;if(s.released)step=std::max(step,-s.releaseRate/sampleRate);for(int j=0;j<n;j++)gains[i][j]=std::max(0.f,s.gain+step*(j+1));s.gain=gains[i][n-1];s.rendered=true;}
        for(auto* f:fonts){if(!f)continue;for(int j=0;j<f->voiceNum;j++){auto& v=f->voices[j];int i=v.playingChannel;if(v.playingPreset==-1||i<0||i>=MAX_SLOTS||!slots[i].handle)continue;std::fill(voiceAudio,voiceAudio+64,0.f);tsf_voice_render(f,&v,voiceAudio,n);for(int k=0;k<n;k++){output[(offset+k)*2]+=voiceAudio[k*2]*gains[i][k];output[(offset+k)*2+1]+=voiceAudio[k*2+1]*gains[i][k];}}}
        for(int i=0;i<MAX_SLOTS;i++)if(slots[i].handle&&slots[i].custom&&!slots[i].env.stage&&slots[i].gain<=1e-7f)kill(i);
    }
    bool sounding[MAX_SLOTS]={};for(auto* f:fonts)if(f)for(int j=0;j<f->voiceNum;j++){auto& v=f->voices[j];if(v.playingPreset!=-1&&v.playingChannel>=0&&v.playingChannel<MAX_SLOTS)sounding[v.playingChannel]=true;}for(int i=0;i<MAX_SLOTS;i++)if(slots[i].handle&&!sounding[i])kill(i);
    return output;
}
