import os,sys,json
sys.argv[1]=os.path.abspath(sys.argv[1])
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','src','main','resources','static'))
def ed(p,*prs):
    s=open(p,encoding='utf8').read()
    for a,b in prs:
        if a not in s: print('MISSING',p,a[:90]); continue
        s=s.replace(a,b,1)
    open(p,'w',encoding='utf8',newline='\n').write(s)
ROOT=os.getcwd()
exec(open(sys.argv[1],encoding='utf8').read())
